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
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { createRequire } from 'module';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

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
 * Exécution interactive en temps réel: le code est compilé avec tsc puis lancé
 * via spawn() (pas execSync) pour garder le processus vivant avec stdin/stdout
 * en pipe. Un petit runtime injecté (runtime.js) fournit un vrai input()
 * global côté Node: il écrit un marqueur caché sur stderr et attend une ligne
 * sur stdin. Le serveur détecte ce marqueur et le relaie au navigateur comme
 * demande d'input ; la réponse du navigateur est réinjectée dans le stdin du
 * processus enfant.
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
 *
 * ⚠️ SÉCURITÉ: identique à l'ancienne route /run — ceci exécute du code
 * arbitraire directement sur ce serveur, sans isolation (pas de conteneur,
 * pas de limites réseau/CPU/mémoire). À ne pas exposer à des utilisateurs non
 * fiables sans Docker (--network none + limites de ressources), gVisor, ou
 * une microVM Firecracker en amont. Traiter comme un outil de dev local.
 */

const INPUT_MARKER = '\u0000INPUT_REQUEST\u0000';

const RUNTIME_JS = `
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, terminal: false });
const queue = [];
rl.on('line', (line) => {
  const resolve = queue.shift();
  if (resolve) resolve(line);
});
global.input = function (promptText) {
  process.stderr.write(${JSON.stringify(INPUT_MARKER)} + (promptText || '') + '\\n');
  return new Promise((resolve) => { queue.push(resolve); });
};
`;

function buildMainTs(userCode) {
  // Enveloppe le code utilisateur dans une IIFE async (comme le sandbox
  // navigateur) plutôt que de compter sur le top-level await natif, qui exige
  // un module ESM et compliquerait inutilement la compilation/exécution ici.
  //
  // process.exit() est appelé explicitement une fois la promesse réglée, car
  // le readline ouvert sur process.stdin (voir RUNTIME_JS) garde la boucle
  // d'événements active indéfiniment — sans cet appel, le process ne se termine
  // jamais tout seul et reste "en cours d'exécution" jusqu'au kill-switch de 30s.
  return [
    'declare function input(prompt?: string): Promise<string>;',
    '(async () => {',
    userCode,
    '})()',
    '  .then(() => process.exit(process.exitCode || 0))',
    '  .catch((err) => {',
    '    console.error(err instanceof Error ? (err.stack || err.message) : String(err));',
    '    process.exit(1);',
    '  });',
  ].join('\n');
}

function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (cleanupErr) {
    console.warn(`Impossible de supprimer le dossier temporaire ${dir}:`, cleanupErr.message);
  }
}

function startRun(ws, code) {
  if (typeof code !== 'string' || !code.trim()) {
    ws.send(JSON.stringify({ type: 'error', text: 'code est requis.' }));
    ws.send(JSON.stringify({ type: 'done', code: null }));
    return null;
  }

  const id = crypto.randomUUID();
  const dir = path.join(os.tmpdir(), `sandbox-${id}`);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'main.ts'), buildMainTs(code));
  fs.writeFileSync(path.join(dir, 'runtime.js'), RUNTIME_JS);
  fs.writeFileSync(path.join(dir, 'run.js'), "require('./runtime.js');\nrequire('./main.js');\n");

  try {
    execSync(`node "${TSC_PATH}" main.ts --target ES2020 --module commonjs --types node --typeRoots "${TYPE_ROOTS}"`, {
      cwd: dir,
      timeout: 5000,
    });
  } catch (e) {
    // tsc écrit ses diagnostics de compilation sur stdout, pas stderr — il faut
    // vérifier stdout en premier, sinon on ne récupère que "Command failed: ..."
    const detail = e.stdout?.toString() || e.stderr?.toString() || e.message;
    ws.send(JSON.stringify({ type: 'error', text: detail }));
    ws.send(JSON.stringify({ type: 'done', code: null }));
    cleanupDir(dir);
    return null;
  }

  const child = spawn('node', ['run.js'], { cwd: dir });

  // Reste d'une ligne stderr incomplète entre deux paquets de données
  let stderrBuffer = '';

  child.stdout.on('data', (chunk) => {
    ws.send(JSON.stringify({ type: 'output', text: chunk.toString() }));
  });

  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString();
    const lines = stderrBuffer.split('\n');
    stderrBuffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith(INPUT_MARKER)) {
        ws.send(JSON.stringify({ type: 'input-request', prompt: line.slice(INPUT_MARKER.length) }));
      } else if (line.length > 0) {
        ws.send(JSON.stringify({ type: 'error', text: line }));
      }
    }
  });

  child.on('error', (err) => {
    ws.send(JSON.stringify({ type: 'error', text: err.message }));
  });

  child.on('exit', (exitCode) => {
    if (stderrBuffer.length > 0) {
      ws.send(JSON.stringify({ type: 'error', text: stderrBuffer }));
    }
    ws.send(JSON.stringify({ type: 'done', code: exitCode }));
    cleanupDir(dir);
  });

  return { child, dir };
}

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/run-ws' });

wss.on('connection', (ws) => {
  let active = null; // { child, dir }

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'run') {
      // Une seule exécution à la fois par connexion: on tue l'ancienne avant d'en lancer une nouvelle
      if (active?.child && active.child.exitCode === null) {
        active.child.kill();
      }
      active = startRun(ws, msg.code);
    } else if (msg.type === 'input') {
      if (active?.child?.stdin.writable) {
        active.child.stdin.write((msg.value ?? '') + '\n');
      }
    } else if (msg.type === 'stop') {
      if (active?.child && active.child.exitCode === null) {
        active.child.kill();
      }
    }
  });

  ws.on('close', () => {
    if (active?.child && active.child.exitCode === null) {
      active.child.kill();
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Backend proxy démarré sur http://localhost:${PORT} (WebSocket /run-ws)`);
});