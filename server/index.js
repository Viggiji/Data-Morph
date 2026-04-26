import express from 'express';
import cors from 'cors';
import { initDatabase } from './db.js';
import chatRouter from './routes/chat.js';
import visionRouter from './routes/vision.js';
import sessionsRouter from './routes/sessions.js';
import schemaBuilderRouter from './routes/schemaBuilder.js';
import schemaRouter from './routes/schema.js';
import exportRouter from './routes/export.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin:  ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '50mb' }));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const ollamaRes = await fetch('http://localhost:11434/api/tags');
    const data      = await ollamaRes.json();
    const models    = data.models?.map((m) => m.name) || [];
    res.json({ status: 'ok', ollama: 'connected', models });
  } catch {
    res.json({ status: 'ok', ollama: 'disconnected', models: [] });
  }
});

// ── Original Routes (untouched) ───────────────────────────────────────────────
app.use('/api/chat',     chatRouter);
app.use('/api/vision',   visionRouter);
app.use('/api/sessions', sessionsRouter);

// ── Schema Builder Routes (new) ───────────────────────────────────────────────
// Order matters: /api/schema/builder must be mounted BEFORE /api/schema
// so that /api/schema/builder/* routes are matched first.
app.use('/api/schema/builder', schemaBuilderRouter);
app.use('/api/schema',         schemaRouter);
app.use('/api/export',         exportRouter);

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    console.log('\n  🔧 Initializing database...');
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\n  🚀 DataMorph API server running on http://localhost:${PORT}`);
      console.log(`  📡 Ollama expected at http://localhost:11434`);
      console.log(`  🗄️  Schema Builder  → /api/schema/builder`);
      console.log(`  📋 Schema CRUD     → /api/schema`);
      console.log(`  📥 Export          → /api/export\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
