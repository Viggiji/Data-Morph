import { Router } from 'express';
import pool from '../db.js';
import { looksLikeCSV } from './schemaBuilder.js';

const router = Router();

const OLLAMA_BASE   = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

// Base system prompt — identity and general capabilities
const BASE_SYSTEM_PROMPT = `You are "Morph Engine", the AI assistant powering Data Morph — a multimodal data management platform.

Your capabilities:
- Answer questions about databases, SQL, data structures, and data management
- Help users understand their data and run analysis against it
- Generate SQL queries from natural language descriptions
- Explain data concepts clearly

Guidelines:
- Be concise but thorough
- When generating SQL always explain what the query does
- Format SQL code in code blocks
- If a question is ambiguous ask for clarification
- Be friendly and professional`;

// ── Build a data-aware system prompt when a schema is selected ────────────────
async function buildSystemPrompt(schemaId, uid) {
  if (!schemaId || !uid) return BASE_SYSTEM_PROMPT;

  try {
    const [tables] = await pool.execute(
      `SELECT tm.table_name, di.raw_content
         FROM dm_table_master tm
         LEFT JOIN dm_input_data di ON di.data_id = tm.data_id
        WHERE tm.table_id = ? AND tm.user_uid = ?`,
      [schemaId, uid]
    );

    if (!tables.length) return BASE_SYSTEM_PROMPT;

    const [attrs] = await pool.execute(
      'SELECT * FROM dm_attributes WHERE table_id = ? ORDER BY attr_id ASC',
      [schemaId]
    );

    const tableName  = tables[0].table_name;
    const rawContent = tables[0].raw_content || '';

    // Build human-readable column summary
    const columnSummary = attrs.map(a => {
      const flags = [];
      if (a.is_primary === 'YES')                              flags.push('PRIMARY KEY');
      if (a.is_nullable === 'NO')                              flags.push('NOT NULL');
      if (a.constraints?.toUpperCase().includes('UNIQUE'))     flags.push('UNIQUE');
      if (a.is_foreign === 'YES' && a.foreign_ref)             flags.push(`FK → ${a.foreign_ref}`);
      return `  - ${a.column_name}  ${a.data_type}${flags.length ? '  [' + flags.join(', ') + ']' : ''}`;
    }).join('\n');

    // First 50 data rows for context (prevents token overflow)
    const dataLines = rawContent
      ? rawContent.trim().split('\n').slice(0, 51).join('\n')
      : '(no data available)';

    const rowCount = rawContent
      ? Math.max(0, rawContent.trim().split('\n').length - 1)
      : 0;

    return (
      BASE_SYSTEM_PROMPT +
      `\n\n${'═'.repeat(60)}\n` +
      `YOU HAVE ACCESS TO THE FOLLOWING TABLE\n` +
      `${'═'.repeat(60)}\n` +
      `Table name : ${tableName}\n` +
      `Total rows : ${rowCount}\n` +
      `Columns    :\n${columnSummary}\n\n` +
      `Data (first ${Math.min(rowCount, 50)} rows shown):\n` +
      `\`\`\`\n${dataLines}\n\`\`\`\n` +
      `${'═'.repeat(60)}\n\n` +
      `Use the data above to answer the user's questions accurately.\n` +
      `When writing SQL, reference the table as \`${tableName}\`.\n` +
      `Be specific: use real column names and real values from the data.`
    );
  } catch (err) {
    console.error('[Chat] Failed to build schema context:', err.message);
    return BASE_SYSTEM_PROMPT;
  }
}

/**
 * POST /api/chat
 * Body: {
 *   message:  string,
 *   history?:  Array<{role, content}>,
 *   model?:   string,
 *   schemaId?: number | string,   ← NEW: active schema to chat about
 *   uid?:     string,             ← needed when schemaId is set
 * }
 */
router.post('/', async (req, res) => {
  const {
    message,
    history  = [],
    model    = DEFAULT_MODEL,
    schemaId = null,
    uid      = null,
  } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required and must be a string.' });
  }

  // ── CSV auto-detection ────────────────────────────────────────────────────
  // Only redirect to schema builder when no active schema is already selected
  if (!schemaId && looksLikeCSV(message)) {
    const firstLine = message.trim().split('\n')[0];
    const cols = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return res.json({
      isCsvDetected:   true,
      suggestion:      `I noticed you pasted CSV data with **${cols.length}** column(s): **${cols.join(', ')}**\n\nWould you like me to **build a database schema** from this? Switch to the **Schema tab** to start, or keep chatting normally.`,
      detectedColumns: cols,
    });
  }

  try {
    // Build the system prompt — generic OR data-aware
    const systemPrompt = await buildSystemPrompt(schemaId, uid);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({
        role:    h.role === 'bot' ? 'assistant' : h.role,
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model, messages, stream: true }),
    });

    if (!ollamaRes.ok) {
      const errorText = await ollamaRes.text();
      console.error('[Ollama Error]', ollamaRes.status, errorText);
      if (ollamaRes.status === 404 || errorText.includes('not found')) {
        return res.status(404).json({ error: `Model "${model}" not found. Run: ollama pull ${model}` });
      }
      return res.status(502).json({ error: 'Ollama returned an error', details: errorText });
    }

    // ── Stream back to client ─────────────────────────────────────────────
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');

    const reader  = ollamaRes.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
            }
            if (parsed.done) {
              res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    res.end();
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      return res.status(503).json({
        error: 'Cannot connect to Ollama. Make sure Ollama is running (`ollama serve`).',
      });
    }
    console.error('[Chat Route Error]', err);
    return res.status(500).json({ error: 'Failed to process chat request', details: err.message });
  }
});

export default router;
