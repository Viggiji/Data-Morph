import express from 'express';
import cors from 'cors';
import { initDatabase } from './db.js';
import chatRouter from './routes/chat.js';
import visionRouter from './routes/vision.js';
import sessionsRouter from './routes/sessions.js';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '50mb' }));

// --- Health Check ---
app.get('/api/health', async (_req, res) => {
  try {
    const ollamaRes = await fetch('http://localhost:11434/api/tags');
    const data = await ollamaRes.json();
    const models = data.models?.map((m) => m.name) || [];
    res.json({ status: 'ok', ollama: 'connected', models });
  } catch {
    res.json({ status: 'ok', ollama: 'disconnected', models: [] });
  }
});

// --- Routes ---
app.use('/api/chat', chatRouter);
app.use('/api/vision', visionRouter);
app.use('/api/sessions', sessionsRouter);

// --- Global Error Handler ---
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// --- Start ---
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\n  🚀 DataMorph API server running on http://localhost:${PORT}`);
      console.log(`  📡 Ollama expected at http://localhost:11434\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
