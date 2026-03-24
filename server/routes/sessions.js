import { Router } from 'express';
import { randomUUID } from 'crypto';
import pool from '../db.js';

const router = Router();

/**
 * GET /api/sessions?uid=<user_uid>
 * Returns the 10 most recent sessions for a user.
 */
router.get('/', async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: 'User UID is required.' });

  try {
    const [sessions] = await pool.execute(
      `SELECT id, title, created_at, updated_at 
       FROM chat_sessions 
       WHERE user_uid = ? 
       ORDER BY updated_at DESC 
       LIMIT 10`,
      [uid]
    );
    res.json({ sessions });
  } catch (err) {
    console.error('[Sessions GET Error]', err);
    res.status(500).json({ error: 'Failed to fetch sessions.' });
  }
});

/**
 * POST /api/sessions
 * Body: { uid: string, title?: string }
 * Creates a new chat session.
 */
router.post('/', async (req, res) => {
  const { uid, title } = req.body;
  if (!uid) return res.status(400).json({ error: 'User UID is required.' });

  const sessionId = randomUUID();
  const sessionTitle = title || 'New Chat';

  try {
    await pool.execute(
      'INSERT INTO chat_sessions (id, user_uid, title) VALUES (?, ?, ?)',
      [sessionId, uid, sessionTitle]
    );
    res.json({ id: sessionId, title: sessionTitle, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  } catch (err) {
    console.error('[Sessions POST Error]', err);
    res.status(500).json({ error: 'Failed to create session.' });
  }
});

/**
 * GET /api/sessions/:sessionId/messages
 * Returns all messages for a given session.
 */
router.get('/:sessionId/messages', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const [messages] = await pool.execute(
      'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
    res.json({ messages });
  } catch (err) {
    console.error('[Messages GET Error]', err);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

/**
 * POST /api/sessions/:sessionId/messages
 * Body: { role: 'user' | 'bot', content: string }
 * Adds a message to a session.
 */
router.post('/:sessionId/messages', async (req, res) => {
  const { sessionId } = req.params;
  const { role, content } = req.body;

  if (!role || !content) {
    return res.status(400).json({ error: 'Role and content are required.' });
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)',
      [sessionId, role, content]
    );

    // Update session's updated_at timestamp
    await pool.execute(
      'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [sessionId]
    );

    res.json({ id: result.insertId, role, content });
  } catch (err) {
    console.error('[Messages POST Error]', err);
    res.status(500).json({ error: 'Failed to save message.' });
  }
});

/**
 * PATCH /api/sessions/:sessionId
 * Body: { title: string }
 * Updates session title (auto-generated from first message).
 */
router.patch('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { title } = req.body;

  if (!title) return res.status(400).json({ error: 'Title is required.' });

  try {
    await pool.execute(
      'UPDATE chat_sessions SET title = ? WHERE id = ?',
      [title.substring(0, 255), sessionId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Session PATCH Error]', err);
    res.status(500).json({ error: 'Failed to update session.' });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * Deletes a session and all its messages (CASCADE).
 */
router.delete('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    await pool.execute('DELETE FROM chat_sessions WHERE id = ?', [sessionId]);
    res.json({ success: true });
  } catch (err) {
    console.error('[Session DELETE Error]', err);
    res.status(500).json({ error: 'Failed to delete session.' });
  }
});

export default router;
