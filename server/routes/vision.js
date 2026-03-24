import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

const OLLAMA_BASE = 'http://localhost:11434';
const VISION_MODEL = 'llava';

// Configure multer for temporary file storage
const upload = multer({
  dest: path.join(process.cwd(), 'temp_uploads'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Supported: JPEG, PNG, GIF, WebP, BMP.`));
    }
  },
});

/**
 * POST /api/vision
 * Multipart form: image file + optional "prompt" field
 *
 * Sends image to Ollama's vision model (llava) for data extraction.
 */
router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }

  const prompt = req.body.prompt || 'Analyze this image thoroughly. Extract all text, data, numbers, and structured information you can find. Present the extracted data in a clean, organized format. If it contains tabular data, format it as a table.';

  try {
    // Read the uploaded image and convert to base64
    const imageBuffer = await fs.readFile(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    // Call Ollama with the vision model
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [base64Image],
          },
        ],
        stream: true,
      }),
    });

    if (!ollamaRes.ok) {
      const errorText = await ollamaRes.text();
      console.error('[Ollama Vision Error]', ollamaRes.status, errorText);

      if (ollamaRes.status === 404 || errorText.includes('not found')) {
        return res.status(404).json({
          error: `Vision model "${VISION_MODEL}" not found. Please run: ollama pull ${VISION_MODEL}`,
        });
      }
      return res.status(502).json({ error: 'Ollama vision returned an error', details: errorText });
    }

    // Stream response back
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
        const lines = chunk.split('\n').filter((l) => l.trim());

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
        error: 'Cannot connect to Ollama. Make sure Ollama is running.',
      });
    }
    console.error('[Vision Route Error]', err);
    return res.status(500).json({ error: 'Failed to process vision request', details: err.message });
  } finally {
    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch {
      // ignore cleanup errors
    }
  }
});

export default router;
