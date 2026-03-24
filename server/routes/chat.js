import { Router } from 'express';

const router = Router();

const OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

// System prompt that gives the AI its identity and purpose
const SYSTEM_PROMPT = `You are "Morph Engine", the AI assistant powering Data Morph — a multimodal data management platform.

Your capabilities:
- Answer questions about databases, SQL, data structures, and data management
- Help users understand their data
- Generate SQL queries from natural language descriptions
- Explain data concepts in simple terms

Guidelines:
- Be concise but thorough
- When generating SQL, always explain what the query does
- If a question is ambiguous, ask for clarification
- Format SQL code in code blocks
- Be friendly and professional`;

/**
 * POST /api/chat
 * Body: { message: string, history?: Array<{role, content}>, model?: string }
 * 
 * Sends user message to Ollama and streams the response back.
 */
router.post('/', async (req, res) => {
  const { message, history = [], model = DEFAULT_MODEL } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required and must be a string.' });
  }

  try {
    // Build conversation messages array for Ollama
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((h) => ({
        role: h.role === 'bot' ? 'assistant' : h.role,
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!ollamaRes.ok) {
      const errorText = await ollamaRes.text();
      console.error('[Ollama Error]', ollamaRes.status, errorText);

      if (ollamaRes.status === 404 || errorText.includes('not found')) {
        return res.status(404).json({
          error: `Model "${model}" not found. Please run: ollama pull ${model}`,
        });
      }
      return res.status(502).json({ error: 'Ollama returned an error', details: errorText });
    }

    // Stream the response back to the client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Ollama sends newline-delimited JSON
        const lines = chunk.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              // Send just the text token
              res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
            }
            if (parsed.done) {
              res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    res.end();
  } catch (err) {
    // Ollama is not running
    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      return res.status(503).json({
        error: 'Cannot connect to Ollama. Make sure Ollama is running (open the Ollama app or run `ollama serve`).',
      });
    }
    console.error('[Chat Route Error]', err);
    return res.status(500).json({ error: 'Failed to process chat request', details: err.message });
  }
});

export default router;
