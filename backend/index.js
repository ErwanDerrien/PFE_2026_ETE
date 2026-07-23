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
import path from 'path';
import { createRequire } from 'module';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { startRunIsolated, activeByWs, compileTsToJs } from './startRunIsolated.js';

// Résout le vrai compilateur du package "typescript" (npm install typescript),
// PAS "npx tsc" — ce dernier, si "typescript" n'est pas installé, va chercher un
// package nommé littéralement "tsc" sur le registre npm et installer un stub
// abandonné (tsc@2.0.4) qui n'est PAS le compilateur TypeScript.
const require = createRequire(import.meta.url);
const TSC_PATH = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
// Le compile se fait dans un dossier temporaire sans lien de parenté avec ce
// projet, donc la résolution habituelle de @types (remontée de node_modules)
// ne trouverait rien. On pointe explicitement vers node_modules/@types d'ici.
const TYPE_ROOTS = path.join(path.dirname(require.resolve('typescript/package.json')), '..', '@types');

const app = express();
const PORT = 3001;

// Filet de sécurité: en Node 26+, une promesse rejetée sans catch termine le
// processus par défaut. On log au lieu de crasher, le temps de traquer la cause.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection (non fatal, backend reste actif):', reason);
});

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

/**
 * WS /run-ws
 *
 * Exécution interactive en temps réel: le code est compilé avec tsc
 * (compileTsToJs) puis lancé dans un isolate V8 séparé (startRunIsolated,
 * via isolated-vm) au lieu d'un vrai processus Node — l'isolate n'a par
 * défaut aucun accès à fs/réseau/process, et le timeout + la limite mémoire
 * sont appliqués par V8 lui-même plutôt que par un kill-switch externe.
 *
 * Messages client -> serveur:
 *   { type: 'run', code: string }
 *   { type: 'input', value: string }
 *   { type: 'stop' }
 *
 * Messages serveur -> client:
 *   { type: 'output', text: string }
 *   { type: 'error', text: string }
 *   { type: 'input-request', prompt: string }
 *   { type: 'done', code: number | null }
 */

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/run-ws' });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'run') {
      let compiled;
      try {
        compiled = compileTsToJs(msg.code, TSC_PATH, TYPE_ROOTS);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', text: e.message }));
        ws.send(JSON.stringify({ type: 'done', code: null }));
        return;
      }
      startRunIsolated(ws, compiled);
    } else if (msg.type === 'input') {
      const state = activeByWs.get(ws);
      if (state?.pendingInputResolve) {
        state.pendingInputResolve(msg.value ?? '');
        state.pendingInputResolve = null;
      }
    } else if (msg.type === 'stop') {
      const state = activeByWs.get(ws);
      if (state?.isolate && !state.isolate.isDisposed) state.isolate.dispose();
    }
  });

  ws.on('close', () => {
    const state = activeByWs.get(ws);
    if (state?.isolate && !state.isolate.isDisposed) state.isolate.dispose();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Backend proxy démarré sur http://localhost:${PORT} (WebSocket /run-ws)`);
});