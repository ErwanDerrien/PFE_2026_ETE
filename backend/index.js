/**
 * backend/index.js — Proxy API Claude.
 *
 * Reçoit les requêtes du frontend et les transfère à l'API Anthropic
 * avec la clé fournie par l'utilisateur. La clé ne transite jamais
 * dans le code frontend bundlé — elle est envoyée uniquement dans
 * le corps de la requête au backend.
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173' })); 
app.use(express.json());

app.post('/api/to-natural-lang', async (req, res) => {
  const { code, apiKey } = req.body;

  if (!code || !apiKey) {
    return res.status(400).json({ error: 'code et apiKey sont requis.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Décris ce code en langage naturel, en français, de façon concise (2-4 phrases). Ne répète pas le code, explique ce qu'il fait.\n\n\`\`\`\n${code}\n\`\`\``,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message ?? 'Erreur Anthropic' });
    }

    const data = await response.json();
    const result = data.content[0].text;
    return res.json({ result });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

/**
 * POST /api/to-code
 * Body: { description: string, apiKey: string }
 * Response: { result: string }
 */
app.post('/api/to-code', async (req, res) => {
  const { description, apiKey } = req.body;

  if (!description || !apiKey) {
    return res.status(400).json({ error: 'description et apiKey sont requis.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Convertis cette description en code TypeScript valide. Réponds UNIQUEMENT avec le code, sans explication, sans balises markdown.\n\nDescription : ${description}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message ?? 'Erreur Anthropic' });
    }

    const data = await response.json();
    const result = data.content[0].text;
    return res.json({ result });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

/**
 * POST /api/verify-key
 * Body: { apiKey: string }
 * Response: { valid: boolean }
 */
app.post('/api/verify-key', async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey est requis.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    if (!response.ok) {
      return res.json({ valid: false });
    }

    return res.json({ valid: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend proxy démarré sur http://localhost:${PORT}`);
});