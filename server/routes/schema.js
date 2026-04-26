/**
 * schema.js — Schema CRUD Routes
 *
 * Endpoints:
 *   GET    /api/schema/list?uid=            — List all schemas for a user
 *   GET    /api/schema/view/:tableId?uid=   — View schema + raw CSV data
 *   PUT    /api/schema/modify/:tableId      — Rename table or update columns
 *   PUT    /api/schema/:tableId/data        — Save edited CSV rows
 *   DELETE /api/schema/:tableId?uid=        — Delete a schema entirely
 */

import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/schema/list?uid=<firebase_uid>
// ══════════════════════════════════════════════════════════════════════════════
router.get('/list', async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: 'uid is required.' });

  try {
    const [tables] = await pool.execute(
      `SELECT
         tm.table_id,
         tm.table_name,
         tm.row_count          AS column_count,
         tm.created_at,
         tm.updated_at,
         ss.is_complete,
         ss.stage
       FROM dm_table_master tm
       LEFT JOIN dm_schema_sessions ss ON ss.table_id = tm.table_id
       WHERE tm.user_uid = ?
         AND tm.table_name NOT LIKE 'pending\\_%'
       ORDER BY tm.updated_at DESC`,
      [uid]
    );
    res.json({ tables });
  } catch (err) {
    console.error('[Schema/list Error]', err);
    res.status(500).json({ error: 'Failed to list schemas.', details: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/schema/view/:tableId?uid=<firebase_uid>
// Returns table metadata + column attributes + raw CSV content
// ══════════════════════════════════════════════════════════════════════════════
router.get('/view/:tableId', async (req, res) => {
  const { tableId } = req.params;
  const { uid }     = req.query;
  if (!uid) return res.status(400).json({ error: 'uid is required.' });

  try {
    // Join dm_input_data to get the raw CSV alongside the table record
    const [tables] = await pool.execute(
      `SELECT tm.*, di.raw_content, di.input_type
         FROM dm_table_master tm
         LEFT JOIN dm_input_data di ON di.data_id = tm.data_id
        WHERE tm.table_id = ? AND tm.user_uid = ?`,
      [tableId, uid]
    );
    if (!tables.length) return res.status(404).json({ error: 'Table not found.' });

    const [attrs] = await pool.execute(
      'SELECT * FROM dm_attributes WHERE table_id = ? ORDER BY attr_id ASC',
      [tableId]
    );

    const [sessions] = await pool.execute(
      'SELECT session_id, stage, is_complete FROM dm_schema_sessions WHERE table_id = ? ORDER BY session_id DESC LIMIT 1',
      [tableId]
    );

    res.json({
      table:      tables[0],
      attributes: attrs,
      session:    sessions[0] || null,
      rawContent: tables[0].raw_content || '',
      inputType:  tables[0].input_type  || 'CSV',
    });
  } catch (err) {
    console.error('[Schema/view Error]', err);
    res.status(500).json({ error: 'Failed to fetch schema.', details: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/schema/:tableId/data
// Body: { uid, rawContent }  — saves edited CSV rows back to dm_input_data
// ══════════════════════════════════════════════════════════════════════════════
router.put('/:tableId/data', async (req, res) => {
  const { tableId }              = req.params;
  const { uid, rawContent = '' } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid is required.' });

  try {
    // Verify ownership
    const [tables] = await pool.execute(
      'SELECT data_id FROM dm_table_master WHERE table_id = ? AND user_uid = ?',
      [tableId, uid]
    );
    if (!tables.length) return res.status(404).json({ error: 'Table not found.' });

    const dataId = tables[0].data_id;

    await pool.execute(
      'UPDATE dm_input_data SET raw_content = ? WHERE data_id = ?',
      [rawContent, dataId]
    );

    // Update row count on table_master
    const rowCount = rawContent.trim().split('\n').length - 1; // minus header
    await pool.execute(
      'UPDATE dm_table_master SET row_count = ?, updated_at = NOW() WHERE table_id = ?',
      [Math.max(0, rowCount), tableId]
    );

    res.json({ success: true, rowCount: Math.max(0, rowCount) });
  } catch (err) {
    console.error('[Schema/data Error]', err);
    res.status(500).json({ error: 'Failed to save data.', details: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/schema/modify/:tableId
// Body: { uid, tableName?, attributes? }
// ══════════════════════════════════════════════════════════════════════════════
router.put('/modify/:tableId', async (req, res) => {
  const { tableId } = req.params;
  const { uid, tableName, attributes } = req.body;

  if (!uid) return res.status(400).json({ error: 'uid is required.' });

  try {
    const [tables] = await pool.execute(
      'SELECT * FROM dm_table_master WHERE table_id = ? AND user_uid = ?',
      [tableId, uid]
    );
    if (!tables.length) return res.status(404).json({ error: 'Table not found.' });

    const changes = [];

    // ── Rename the table ───────────────────────────────────────────────────
    if (tableName) {
      const cleanName = tableName
        .replace(/[^a-zA-Z0-9_\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .toLowerCase();
      await pool.execute(
        'UPDATE dm_table_master SET table_name = ? WHERE table_id = ?',
        [cleanName, tableId]
      );
      changes.push(`Renamed to '${cleanName}'`);
    }

    // ── Update attributes ──────────────────────────────────────────────────
    if (Array.isArray(attributes) && attributes.length > 0) {
      // Full replace strategy: delete old, insert new
      await pool.execute('DELETE FROM dm_attributes WHERE table_id = ?', [tableId]);

      for (const attr of attributes) {
        if (!attr.column_name) continue;
        await pool.execute(
          `INSERT INTO dm_attributes
             (table_id, column_name, data_type, is_nullable, is_primary,
              is_foreign, foreign_ref, default_value, constraints)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tableId,
            attr.column_name.trim(),
            attr.data_type     || 'VARCHAR(100)',
            attr.is_nullable   || 'YES',
            attr.is_primary    || 'NO',
            attr.is_foreign    || 'NO',
            attr.foreign_ref   || null,
            attr.default_value || null,
            attr.constraints   || null,
          ]
        );
      }

      // Update column count
      await pool.execute(
        'UPDATE dm_table_master SET row_count = ? WHERE table_id = ?',
        [attributes.length, tableId]
      );

      changes.push(`Updated ${attributes.length} column(s)`);
    }

    // ── Audit log ──────────────────────────────────────────────────────────
    if (changes.length) {
      await pool.execute(
        'INSERT INTO dm_modify_log (user_uid, table_id, change_note) VALUES (?, ?, ?)',
        [uid, tableId, changes.join('; ')]
      );
    }

    res.json({ success: true, changes, tableId: Number(tableId) });
  } catch (err) {
    console.error('[Schema/modify Error]', err);
    res.status(500).json({ error: 'Failed to modify schema.', details: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/schema/:tableId?uid=<firebase_uid>
// ══════════════════════════════════════════════════════════════════════════════
router.delete('/:tableId', async (req, res) => {
  const { tableId } = req.params;
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: 'uid is required.' });

  try {
    const [result] = await pool.execute(
      'DELETE FROM dm_table_master WHERE table_id = ? AND user_uid = ?',
      [tableId, uid]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Table not found.' });
    }
    res.json({ success: true, message: `Table ${tableId} deleted.` });
  } catch (err) {
    console.error('[Schema/delete Error]', err);
    res.status(500).json({ error: 'Failed to delete schema.', details: err.message });
  }
});

export default router;
