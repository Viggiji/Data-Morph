/**
 * schemaBuilder.js — 7-Step Schema Builder Chatbot Routes
 *
 * Endpoints:
 *   POST /api/schema/builder/start         — Start a new schema-builder session
 *   POST /api/schema/builder/message       — Send answer, get next question + live schema
 *   GET  /api/schema/builder/session/:id/history — Full Q&A history for a session
 *   POST /api/schema/builder/detect        — Check if text looks like CSV
 *
 * Session state is held in-memory (Map) for speed.
 * DB is written at start (input saved) and at stage 7 (attributes saved).
 */

import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// ── In-memory session state ────────────────────────────────────────────────────
// Shape: Map<sessionId (Number), SessionState>
const sessionState = new Map();

// ── Type inference from column name + sample value ────────────────────────────
function inferType(colName, sampleValue = '') {
  const col = colName.toLowerCase().trim();

  if (/\bid\b$|_id$/.test(col))                                     return 'INT';
  if (/^count|^num|count$|_no$|_num$|_count$|age$|year$/.test(col)) return 'INT';
  if (/price|salary|amount|cost|rate|fee|tax|discount/.test(col))   return 'DECIMAL(10,2)';
  if (/date|time|created|updated|born|expires|timestamp/.test(col)) return 'DATETIME';
  if (/^is_|^has_|flag$|active$|enabled$|verified$|status$/.test(col) &&
      ['0','1','true','false','yes','no'].includes((sampleValue+'').toLowerCase())) return 'BOOLEAN';
  if (/email/.test(col))                                             return 'VARCHAR(255)';
  if (/phone|mobile|fax/.test(col))                                  return 'VARCHAR(20)';
  if (/description|notes|comment|message|body|content/.test(col))   return 'TEXT';
  if (sampleValue && String(sampleValue).length > 100)               return 'TEXT';

  return 'VARCHAR(100)';
}

// ── Ollama config for AI extraction ────────────────────────────────────────────
const OLLAMA_BASE   = 'http://localhost:11434';
const EXTRACT_MODEL = 'gemma4';
const FALLBACK_MODEL = 'llama3.2';

// ── AI-powered extraction: freeform text → structured {columns, types, rows} ──
async function extractWithAI(rawContent) {
  const prompt = `You are a data extraction expert. The user has provided unstructured text containing real data. Your job:

1. Figure out what columns/fields exist in the data
2. Extract ALL the actual data rows the user provided
3. Return ONLY valid JSON (no markdown fences, no explanation, no extra text):

{"columns":["col1","col2"],"types":["SQL_TYPE","SQL_TYPE"],"rows":[["val","val"],["val","val"]]}

Rules:
- Column names must be snake_case, lowercase, no spaces
- Types must be one of: INT, VARCHAR(50), VARCHAR(100), VARCHAR(255), TEXT, DECIMAL(10,2), DATE, DATETIME, BOOLEAN
- Extract ONLY data the user actually provided — do NOT invent or fabricate rows
- If a value is missing or unclear, use empty string ""
- Keep the data exactly as the user gave it
- Return ONLY the JSON object, nothing else

User's text:
"""
${rawContent}
"""`;

  // Try primary model, then fallback
  const models = [EXTRACT_MODEL, FALLBACK_MODEL];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[AI Extract] Trying model: ${model}...`);
      const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Ollama ${res.status}: ${errBody.substring(0, 200)}`);
      }

      const data = await res.json();
      const responseText = (data.response || '').trim();

      // Try to extract JSON from the response (LLM sometimes wraps in markdown)
      let jsonStr = responseText;
      const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();

      const parsed = JSON.parse(jsonStr);

      // Validate structure
      if (!Array.isArray(parsed.columns) || parsed.columns.length === 0) {
        throw new Error('AI returned no columns');
      }
      if (!Array.isArray(parsed.rows)) {
        parsed.rows = [];
      }
      if (!Array.isArray(parsed.types) || parsed.types.length !== parsed.columns.length) {
        parsed.types = parsed.columns.map(() => 'VARCHAR(100)');
      }

      console.log(`[AI Extract] Success with ${model}: ${parsed.columns.length} cols, ${parsed.rows.length} rows`);
      return parsed;
    } catch (err) {
      console.warn(`[AI Extract] ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('All AI models failed');
}

// ── Convert AI result → CSV string ─────────────────────────────────────────────
function aiResultToCSV(aiResult) {
  const { columns, rows } = aiResult;
  const escapeCSV = (v) => {
    const s = String(v ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = columns.join(',');
  const dataLines = (rows || []).map(row =>
    columns.map((_, i) => escapeCSV(row[i] ?? '')).join(',')
  );
  return [header, ...dataLines].join('\n');
}

// ── Improved regex fallback for plain text (when Ollama is unavailable) ────────
function fallbackParseText(rawContent) {
  const lines = rawContent.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const columns = [];

  // Pattern 1: "column_name - description" or "column_name: description"
  for (const line of lines) {
    const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*[-:–—]\s*.+/);
    if (match) {
      columns.push(match[1].toLowerCase().replace(/\s+/g, '_'));
    }
  }

  if (columns.length >= 2) {
    return { columns: [...new Set(columns)], sample: {} };
  }

  // Pattern 2: extract words that look like column identifiers
  const candidates = rawContent
    .split(/[\s,;.|()]+/)
    .map(w => w.replace(/[^a-zA-Z0-9_]/g, '').trim().toLowerCase())
    .filter(w => w.length >= 2 && w.length <= 40)
    .filter(w =>
      w.includes('_') ||
      /^(id|name|email|phone|date|time|age|price|cost|status|type|count|code|url|title|description|address|city|state|country|zip|role|active|created|updated)$/i.test(w)
    );

  const unique = [...new Set(candidates)].slice(0, 20);
  return { columns: unique.length ? unique : ['column1'], sample: {} };
}

// ── Parse columns from raw CSV or plain text ──────────────────────────────────
function parseInput(rawContent, inputType) {
  const lines = rawContent.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { columns: [], sample: {} };

  if (inputType === 'CSV') {
    // First line = headers
    const headers = lines[0]
      .split(',')
      .map(h => h.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '_'));
    const sample = {};
    if (lines.length > 1) {
      const vals = lines[1].split(',');
      headers.forEach((h, i) => {
        sample[h] = (vals[i] || '').trim().replace(/^["']|["']$/g, '');
      });
    }
    return { columns: headers, sample };
  } else {
    // Plain text — grab words that look like column names
    const words = rawContent
      .split(/[\s,;.|]+/)
      .map(w => w.replace(/[^a-zA-Z0-9_]/g, '').trim())
      .filter(w => w.length >= 2 && w.length <= 64)
      .slice(0, 20);
    return { columns: [...new Set(words)], sample: {} };
  }
}

// ── Lightweight CSV detection ─────────────────────────────────────────────────
export function looksLikeCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const cols = lines[0].split(',');
  if (cols.length < 2) return false;
  // Headers should look like identifiers (letters, numbers, underscores, spaces)
  const allHeadersClean = cols.every(c => /^[\w\s"']+$/.test(c.trim()));
  // At least the second line should have a similar column count
  const secondLineCols = lines[1].split(',').length;
  return allHeadersClean && secondLineCols === cols.length;
}

// ── Ensure user exists in dm_users ────────────────────────────────────────────
async function ensureUser(userUid, displayName = null, email = null) {
  await pool.execute(
    `INSERT INTO dm_users (user_uid, display_name, email)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = COALESCE(VALUES(display_name), display_name),
       email        = COALESCE(VALUES(email), email),
       updated_at   = CURRENT_TIMESTAMP`,
    [userUid, displayName, email]
  );
}

// ── Build live schema preview from partial answers ─────────────────────────────
function buildLivePreview(state) {
  const { columns, inferredTypes, answers, stage } = state;
  return columns.map(col => ({
    column_name:  col,
    data_type:    (answers.dataTypes || inferredTypes)[col] || 'VARCHAR(100)',
    is_primary:   stage >= 2  ? (answers.pk === col ? 'YES' : 'NO') : '?',
    is_nullable:  stage >= 3  ? ((answers.nullable || []).includes(col) ? 'YES' : 'NO') : '?',
    is_unique:    stage >= 4  ? ((answers.unique || []).includes(col) ? 'YES' : 'NO') : '?',
    is_foreign:   stage >= 7  ? ((answers.foreignKeys || {})[col] ? 'YES' : 'NO') : '?',
    foreign_ref:  (answers.foreignKeys || {})[col] || null,
    constraints:  stage >= 6  ? ((answers.checks || {})[col] || null) : null,
    confirmed:    stage >= 7,
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/schema/builder/start
// Body: { uid, displayName?, email?, rawContent, inputType? }
// ══════════════════════════════════════════════════════════════════════════════
router.post('/start', async (req, res) => {
  const { uid, displayName, email, rawContent, inputType = 'CSV' } = req.body;

  if (!uid)             return res.status(400).json({ error: 'uid is required.' });
  if (!rawContent?.trim()) return res.status(400).json({ error: 'rawContent is required.' });

  try {
    await ensureUser(uid, displayName, email);

    let columns, sample, inferredTypes, csvForStorage;

    if (inputType === 'TEXT') {
      // ── AI-powered extraction for freeform text ───────────────────────
      let aiResult = null;
      try {
        console.log('[Schema/start] Extracting with AI (gemma3)...');
        aiResult = await extractWithAI(rawContent);
        console.log(`[Schema/start] AI extracted ${aiResult.columns.length} columns, ${aiResult.rows?.length || 0} rows`);
      } catch (aiErr) {
        console.warn('[Schema/start] AI extraction failed, using fallback:', aiErr.message);
      }

      if (aiResult && aiResult.columns.length > 0) {
        // AI succeeded — use AI-extracted columns + types
        columns = aiResult.columns;
        inferredTypes = {};
        columns.forEach((col, i) => {
          inferredTypes[col] = aiResult.types[i] || inferType(col, '');
        });

        // Build CSV from AI-extracted data (user's actual data)
        csvForStorage = aiResultToCSV(aiResult);

        // Build sample from first row for type inference refinement
        sample = {};
        if (aiResult.rows && aiResult.rows.length > 0) {
          columns.forEach((col, i) => {
            sample[col] = aiResult.rows[0][i] || '';
          });
        }
      } else {
        // Fallback — improved regex parser (no data extraction)
        const fallback = fallbackParseText(rawContent);
        columns = fallback.columns;
        sample = fallback.sample;
        inferredTypes = {};
        columns.forEach(col => {
          inferredTypes[col] = inferType(col, sample[col] || '');
        });
        csvForStorage = rawContent; // store original text as-is
      }
    } else {
      // ── Standard CSV parsing ──────────────────────────────────────────
      const parsed = parseInput(rawContent, inputType);
      columns = parsed.columns;
      sample = parsed.sample;
      inferredTypes = {};
      columns.forEach(col => {
        inferredTypes[col] = inferType(col, sample[col] || '');
      });
      csvForStorage = rawContent;
    }

    if (columns.length === 0) {
      return res.status(400).json({ error: 'Could not detect any columns in the provided content.' });
    }

    // Persist raw input (original user text)
    const [inputResult] = await pool.execute(
      'INSERT INTO dm_input_data (user_uid, raw_content, input_type) VALUES (?, ?, ?)',
      [uid, csvForStorage, inputType]
    );
    const dataId = inputResult.insertId;

    // Create placeholder table record (name set properly at Q1)
    const [tableResult] = await pool.execute(
      'INSERT INTO dm_table_master (user_uid, data_id, table_name) VALUES (?, ?, ?)',
      [uid, dataId, `pending_${Date.now()}`]
    );
    const tableId = tableResult.insertId;

    // Create schema session
    const [sessionResult] = await pool.execute(
      'INSERT INTO dm_schema_sessions (table_id, stage) VALUES (?, 0)',
      [tableId]
    );
    const sessionId = sessionResult.insertId;

    // Store in memory
    sessionState.set(sessionId, {
      stage:         0,
      columns,
      inferredTypes,
      tableId,
      dataId,
      answers:       {},
    });

    const typePreview = columns
      .map(c => `\`${c}\` → \`${inferredTypes[c]}\``)
      .join('\n');

    const aiNote = inputType === 'TEXT' ? '🤖 *AI extracted the following from your text:*\n\n' : '';

    const botMsg =
      `👋 ${aiNote}I detected **${columns.length} column(s)** from your data:\n\n` +
      `${columns.map(c => `• \`${c}\``).join('\n')}\n\n` +
      `**Inferred types:**\n${typePreview}\n\n` +
      `---\n**Question 1/7 — Table Name**\n` +
      `What should we call this table? *(e.g. \`users\`, \`orders\`)*`;

    await pool.execute(
      'INSERT INTO dm_schema_history (session_id, role, message) VALUES (?, "bot", ?)',
      [sessionId, botMsg]
    );

    res.json({
      sessionId,
      tableId,
      botMessage:    botMsg,
      columns,
      inferredTypes,
      stage:         0,
      currentSchema: buildLivePreview(sessionState.get(sessionId)),
      rawContent:    csvForStorage,  // send back the CSV so frontend can update DataGrid
    });

  } catch (err) {
    console.error('[Schema/start Error]', err);
    res.status(500).json({ error: 'Failed to start schema builder.', details: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/schema/builder/message
// Body: { sessionId, message, uid }
// ══════════════════════════════════════════════════════════════════════════════
router.post('/message', async (req, res) => {
  const { sessionId, message, uid } = req.body;

  if (!sessionId || !message || !uid) {
    return res.status(400).json({ error: 'sessionId, message, and uid are required.' });
  }

  const sid = Number(sessionId);
  const state = sessionState.get(sid);
  if (!state) {
    return res.status(404).json({
      error: 'Session not found or already completed. Please start a new schema session.',
    });
  }

  const { columns, inferredTypes, tableId, answers } = state;
  const userAnswer = message.trim();

  try {
    // Save user message
    await pool.execute(
      'INSERT INTO dm_schema_history (session_id, role, message) VALUES (?, "user", ?)',
      [sessionId, userAnswer]
    );

    let botMsg     = '';
    let isComplete = false;
    let finalSchema = null;

    // ── Stage machine ──────────────────────────────────────────────────────────
    switch (state.stage) {

      // ── Q1: Table Name ────────────────────────────────────────────────────
      case 0: {
        const raw = userAnswer.replace(/[^a-zA-Z0-9_\s]/g, '').trim().replace(/\s+/g, '_').toLowerCase();
        const tableName = raw || `table_${tableId}`;
        answers.tableName = tableName;

        await pool.execute(
          'UPDATE dm_table_master SET table_name = ? WHERE table_id = ?',
          [tableName, tableId]
        );

        state.stage = 1;
        botMsg =
          `✅ Table name set to **\`${tableName}\`**\n\n` +
          `---\n**Question 2/7 — Primary Key**\n` +
          `Which column should be the **PRIMARY KEY**?\n\n` +
          `Available columns: ${columns.map(c => `\`${c}\``).join(', ')}\n` +
          `*(Type the exact column name)*`;
        break;
      }

      // ── Q2: Primary Key ───────────────────────────────────────────────────
      case 1: {
        const pk = columns.find(c => c.toLowerCase() === userAnswer.toLowerCase()) || columns[0];
        answers.pk = pk;

        state.stage = 2;
        const rest = columns.filter(c => c !== pk);
        botMsg =
          `✅ **\`${pk}\`** will be the PRIMARY KEY.\n\n` +
          `---\n**Question 3/7 — Nullable Columns**\n` +
          `Which columns can be **NULL** (optional / not required)?\n\n` +
          `Remaining columns: ${rest.map(c => `\`${c}\``).join(', ')}\n` +
          `*(comma-separated, or type \`none\`)*`;
        break;
      }

      // ── Q3: Nullable ──────────────────────────────────────────────────────
      case 2: {
        const raw = userAnswer.toLowerCase().trim();
        answers.nullable = raw === 'none'
          ? []
          : raw.split(',')
              .map(s => s.trim())
              .filter(s => columns.some(c => c.toLowerCase() === s.toLowerCase()))
              .map(s => columns.find(c => c.toLowerCase() === s.toLowerCase()));

        state.stage = 3;
        const nullList = answers.nullable.length
          ? answers.nullable.map(c => `\`${c}\``).join(', ')
          : 'None (all required)';

        botMsg =
          `✅ Nullable columns: **${nullList}**\n\n` +
          `---\n**Question 4/7 — Unique Columns**\n` +
          `Which columns should have a **UNIQUE** constraint?\n\n` +
          `*(comma-separated, or type \`none\`)*`;
        break;
      }

      // ── Q4: Unique ────────────────────────────────────────────────────────
      case 3: {
        const raw = userAnswer.toLowerCase().trim();
        answers.unique = raw === 'none'
          ? []
          : raw.split(',')
              .map(s => s.trim())
              .filter(s => columns.some(c => c.toLowerCase() === s.toLowerCase()))
              .map(s => columns.find(c => c.toLowerCase() === s.toLowerCase()));

        state.stage = 4;
        const uniqList = answers.unique.length
          ? answers.unique.map(c => `\`${c}\``).join(', ')
          : 'None';
        const typeLines = columns
          .map(c => `  \`${c}\` → \`${inferredTypes[c]}\``)
          .join('\n');

        botMsg =
          `✅ Unique columns: **${uniqList}**\n\n` +
          `---\n**Question 5/7 — Data Types**\n` +
          `Here are the auto-inferred types:\n\n${typeLines}\n\n` +
          `To override, write \`column=TYPE\` *(comma-separated)*\n` +
          `Example: \`age=INT, salary=DECIMAL(10,2), notes=TEXT\`\n\n` +
          `Or type \`ok\` to accept all.`;
        break;
      }

      // ── Q5: Data Types ────────────────────────────────────────────────────
      case 4: {
        if (userAnswer.toLowerCase().trim() !== 'ok') {
          userAnswer.split(',').forEach(part => {
            const [col, dtype] = part.split('=').map(s => s.trim());
            const matched = columns.find(c => c.toLowerCase() === col?.toLowerCase());
            if (matched && dtype) {
              inferredTypes[matched] = dtype.toUpperCase();
            }
          });
        }
        answers.dataTypes = { ...inferredTypes };

        state.stage = 5;
        botMsg =
          `✅ Data types confirmed.\n\n` +
          `---\n**Question 6/7 — Check Constraints**\n` +
          `Any **CHECK** constraints on columns?\n\n` +
          `Example: \`age > 0, salary >= 5000, rating <= 5\`\n\n` +
          `Or type \`none\``;
        break;
      }

      // ── Q6: Check Constraints ─────────────────────────────────────────────
      case 5: {
        const raw = userAnswer.toLowerCase().trim();
        const checks = {};
        if (raw !== 'none') {
          userAnswer.split(',').forEach(part => {
            const trimmed = part.trim();
            const match = trimmed.match(/^(\w+)\s*([><=!]+)\s*.+$/);
            if (match) {
              const matchedCol = columns.find(c => c.toLowerCase() === match[1].toLowerCase());
              if (matchedCol) {
                checks[matchedCol] = `CHECK (${trimmed})`;
              }
            }
          });
        }
        answers.checks = checks;

        const checkList = Object.keys(checks).length
          ? Object.entries(checks).map(([c, v]) => `\`${c}\`: ${v}`).join(', ')
          : 'None';

        state.stage = 6;
        botMsg =
          `✅ Constraints noted: **${checkList}**\n\n` +
          `---\n**Question 7/7 — Foreign Keys**\n` +
          `Do any columns reference another table?\n\n` +
          `Format: \`column=OtherTable.OtherColumn\`\n` +
          `Example: \`user_id=users.id, category_id=categories.id\`\n\n` +
          `Or type \`none\``;
        break;
      }

      // ── Q7: Foreign Keys → FINALIZE & SAVE ───────────────────────────────
      case 6: {
        const raw = userAnswer.toLowerCase().trim();
        const foreignKeys = {};
        if (raw !== 'none') {
          userAnswer.split(',').forEach(part => {
            const [col, ref] = part.split('=').map(s => s.trim());
            const matchedCol = columns.find(c => c.toLowerCase() === col?.toLowerCase());
            if (matchedCol && ref?.includes('.')) {
              foreignKeys[matchedCol] = ref;
            }
          });
        }
        answers.foreignKeys = foreignKeys;
        state.stage = 7;

        // ── Write all attributes to DB ──────────────────────────────────────
        const pk       = answers.pk       || columns[0];
        const nullable = answers.nullable || [];
        const unique   = answers.unique   || [];
        const types    = answers.dataTypes || inferredTypes;
        const checks   = answers.checks   || {};

        for (const col of columns) {
          const constraintParts = [];
          if (unique.includes(col))  constraintParts.push('UNIQUE');
          if (checks[col])           constraintParts.push(checks[col]);

          await pool.execute(
            `INSERT INTO dm_attributes
               (table_id, column_name, data_type, is_nullable, is_primary, is_foreign, foreign_ref, constraints)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               data_type   = VALUES(data_type),
               is_nullable = VALUES(is_nullable),
               is_primary  = VALUES(is_primary),
               is_foreign  = VALUES(is_foreign),
               foreign_ref = VALUES(foreign_ref),
               constraints = VALUES(constraints)`,
            [
              tableId,
              col,
              types[col]             || 'VARCHAR(100)',
              nullable.includes(col) ? 'YES' : 'NO',
              col === pk             ? 'YES' : 'NO',
              foreignKeys[col]       ? 'YES' : 'NO',
              foreignKeys[col]       || null,
              constraintParts.join(', ') || null,
            ]
          );
        }

        // Mark session complete
        await pool.execute(
          'UPDATE dm_schema_sessions SET is_complete = 1, stage = 7 WHERE session_id = ?',
          [sessionId]
        );

        // Update column count
        await pool.execute(
          'UPDATE dm_table_master SET row_count = ? WHERE table_id = ?',
          [columns.length, tableId]
        );

        // Build final snapshot for response
        finalSchema = columns.map(col => ({
          column_name: col,
          data_type:   types[col]        || 'VARCHAR(100)',
          is_primary:  col === pk        ? 'YES' : 'NO',
          is_nullable: nullable.includes(col) ? 'YES' : 'NO',
          is_foreign:  foreignKeys[col]  ? 'YES' : 'NO',
          foreign_ref: foreignKeys[col]  || null,
          is_unique:   unique.includes(col) ? 'YES' : 'NO',
          constraints: checks[col]       || null,
          confirmed:   true,
        }));

        isComplete = true;
        botMsg =
          `🎉 **Schema complete!**\n\n` +
          `Table **\`${answers.tableName}\`** has been saved with **${columns.length} column(s)**.\n\n` +
          `You can now:\n` +
          `• 👁️ **View** the schema below\n` +
          `• ✏️ **Edit** any column by clicking on it\n` +
          `• 📥 **Export** as SQL or MongoDB/NoSQL\n\n` +
          `Nicely done! 🚀`;

        // Free memory
        sessionState.delete(sid);
        break;
      }

      default: {
        botMsg = `⚠️ This session is already complete. Start a new one to build another table.`;
      }
    }

    // Save bot message
    await pool.execute(
      'INSERT INTO dm_schema_history (session_id, role, message) VALUES (?, "bot", ?)',
      [sessionId, botMsg]
    );

    // Send live preview for in-progress stages
    const liveSchema = isComplete
      ? finalSchema
      : (state.stage > 0 ? buildLivePreview(state) : null);

    res.json({
      botMessage:    botMsg,
      isComplete,
      tableId,
      stage:         state.stage,
      currentSchema: liveSchema,
    });

  } catch (err) {
    console.error('[Schema/message Error]', err);
    res.status(500).json({ error: 'Failed to process message.', details: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/schema/builder/session/:sessionId/history
// ══════════════════════════════════════════════════════════════════════════════
router.get('/session/:sessionId/history', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const [rows] = await pool.execute(
      `SELECT role, message, created_at
         FROM dm_schema_history
        WHERE session_id = ?
        ORDER BY chat_id ASC`,
      [sessionId]
    );
    res.json({ history: rows });
  } catch (err) {
    console.error('[Schema/history Error]', err);
    res.status(500).json({ error: 'Failed to fetch session history.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/schema/builder/detect
// Body: { text }
// Returns: { isCSV, columnCount, previewColumns }
// ══════════════════════════════════════════════════════════════════════════════
router.post('/detect', (req, res) => {
  const { text = '' } = req.body;
  const isCSV = looksLikeCSV(text);
  let previewColumns = [];
  if (isCSV) {
    const firstLine = text.trim().split('\n')[0];
    previewColumns = firstLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  }
  res.json({ isCSV, columnCount: previewColumns.length, previewColumns });
});

export default router;
