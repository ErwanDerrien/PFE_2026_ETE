/**
 * startRun() rewritten with isolated-vm instead of spawn('node', ...).
 *
 * npm install isolated-vm
 *
 * Same WS protocol as before:
 *   -> { type: 'output', text }
 *   -> { type: 'error', text }
 *   -> { type: 'input-request', prompt }
 *   -> { type: 'done', code }
 *
 * Compilation step (tsc) is UNCHANGED — we still compile TypeScript to
 * JavaScript on disk first, then load the compiled JS text and run it
 * inside an isolated V8 context instead of a full Node child process.
 */

import ivm from 'isolated-vm';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
// TSC_PATH and TYPE_ROOTS come from your existing index.js setup:
//   const TSC_PATH = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
//   const TYPE_ROOTS = path.join(path.dirname(require.resolve('typescript/package.json')), '..', '@types');
// Import or pass them in — shown here as parameters for portability.

const MEMORY_LIMIT_MB = 128;         // isolate-level memory cap

// isolated-vm's script `timeout` counts WALL-CLOCK time, including time
// spent blocked inside applySyncPromise waiting on the browser to answer
// input() — so a single timeout can't tell "stuck in an infinite loop" apart
// from "waiting on the user." We use three independent mechanisms instead:
const CPU_TIME_LIMIT_MS = 5_000;     // max ACTUAL CPU burned — catches infinite
// loops without penalizing input waits,
// since cpuTime only accrues while V8 is
// actively executing, not while suspended.
const CPU_CHECK_INTERVAL_MS = 200;   // how often we poll isolate.cpuTime
const MAX_SESSION_MS = 10 * 60_000;  // absolute backstop for abandoned connections
const MAX_OUTPUT_LINES = 5_000;      // hard cap so a logging loop can't flood the browser
const OUTPUT_FLUSH_MS = 50;          // batch console.log calls into one WS message

/**
 * Compiles user TypeScript to plain JS text, synchronously, using the same
 * `tsc` binary + typeRoots your project already resolves for the old
 * spawn()-based flow. No IIFE/process.exit wrapping here — that's added by
 * buildIsolateScript() at run time instead, since the isolate has no
 * process.exit and needs its own promise-based completion handling.
 *
 * Throws an Error with tsc's diagnostic output as `.message` on failure —
 * catch this in your ws 'run' handler the same way you catch execSync
 * failures today.
 *
 * User code is wrapped in an async IIFE before compiling, same as the old
 * spawn-based buildMainTs() — without this, `tsc` rejects any top-level
 * `await` with TS1375/TS1378, since main.ts has no imports/exports and is
 * therefore treated as a script, not a module. The IIFE's own .catch()
 * reports errors via console.error (which buildIsolateScript wires to the
 * WS 'error' message) instead of process.exit, since the isolate has no
 * process object.
 */
function compileTsToJs(userCode, tscPath, typeRoots) {
    const id = crypto.randomUUID();
    const dir = path.join(os.tmpdir(), `compile-${id}`);
    fs.mkdirSync(dir);

    try {
        const source = [
            'declare function input(prompt?: string): Promise<string>;',
            '(async () => {',
            userCode,
            '})().catch((err) => {',
            '  console.error(err instanceof Error ? (err.stack || err.message) : String(err));',
            '});',
        ].join('\n');
        fs.writeFileSync(path.join(dir, 'main.ts'), source);

        try {
            execSync(
                `node "${tscPath}" main.ts --target ES2020 --module commonjs --types node --typeRoots "${typeRoots}"`,
                { cwd: dir, timeout: 5000 }
            );
        } catch (e) {
            // tsc writes diagnostics to stdout, not stderr — same gotcha as the
            // original spawn-based compile step.
            const detail = e.stdout?.toString() || e.stderr?.toString() || e.message;
            throw new Error(detail);
        }

        return fs.readFileSync(path.join(dir, 'main.js'), 'utf8');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
}

/**
 * Wraps compiled JS so `input()` calls inside user code resolve against
 * an async host function we expose as `__input`. No stdin/readline needed
 * because there's no OS process — the isolate has no stdin at all.
 *
 * compiledJs is ALREADY a self-invoking, self-catching async IIFE (added by
 * compileTsToJs before the TS compile step, to satisfy tsc's top-level-await
 * requirement). So we don't wrap it in a second IIFE here — we just define
 * the globals it needs as plain statements first, then let the compiledJs
 * IIFE call itself. Its call expression is the script's last statement, so
 * its returned promise becomes the script's completion value, which
 * isolate.compileScript's `{ promise: true }` run option (see
 * startRunIsolated) will actually wait on.
 */
function buildIsolateScript(compiledJs) {
    return [
        'globalThis.input = async function (promptText) {',
        '  return await __input.applySyncPromise(undefined, [promptText || ""]);',
        '};',
        'globalThis.console = {',
        '  log: (...args) => __output.applySyncPromise(undefined, [args.map(String).join(" ")]),',
        '  error: (...args) => __error.applySyncPromise(undefined, [args.map(String).join(" ")]),',
        '};',
        compiledJs,
    ].join('\n');
}

// active[ws] = { isolate, pendingInputResolve } so ws 'input' messages
// know where to deliver the answer, and 'stop' knows what to dispose.
const activeByWs = new WeakMap();

async function startRunIsolated(ws, compiledJs) {
    if (typeof compiledJs !== 'string' || !compiledJs.trim()) {
        ws.send(JSON.stringify({ type: 'error', text: 'code compilé est requis.' }));
        ws.send(JSON.stringify({ type: 'done', code: null }));
        return;
    }

    const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });
    const context = await isolate.createContext();
    const jail = context.global;
    await jail.set('global', jail.derefInto());

    const state = { isolate, pendingInputResolve: null };
    activeByWs.set(ws, state);

    // --- Output batching + hard cap -------------------------------------
    // Buffer console.log lines and flush them as ONE ws message every
    // OUTPUT_FLUSH_MS, instead of one ws.send() per line. A loop doing
    // console.log millions of times a second was previously sending a ws
    // message per call — the browser tab couldn't render the flood and froze.
    let outputBuffer = [];
    let outputLineCount = 0;
    let outputTruncated = false;

    function flushOutput() {
        if (outputBuffer.length === 0) return;
        ws.send(JSON.stringify({ type: 'output', text: outputBuffer.join('\n') + '\n' }));
        outputBuffer = [];
    }
    const flushTimer = setInterval(flushOutput, OUTPUT_FLUSH_MS);

    // --- CPU-time watchdog -----------------------------------------------
    // isolate.cpuTime only accumulates while V8 is actually executing code
    // in this isolate — it does NOT advance while the isolate is suspended
    // waiting on applySyncPromise (e.g. blocked on input()). So this catches
    // genuine infinite loops without punishing someone who takes a minute to
    // type an answer.
    const cpuWatchdog = setInterval(() => {
        if (isolate.isDisposed) return;
        const cpuMs = Number(isolate.cpuTime) / 1e6; // cpuTime is bigint nanoseconds
        if (cpuMs > CPU_TIME_LIMIT_MS) {
            ws.send(JSON.stringify({
                type: 'error',
                text: `Temps CPU dépassé (${CPU_TIME_LIMIT_MS}ms) — boucle infinie probable, exécution arrêtée.`,
            }));
            if (!isolate.isDisposed) isolate.dispose();
        }
    }, CPU_CHECK_INTERVAL_MS);

    // --- Absolute session backstop ----------------------------------------
    // Independent of CPU usage or input waits — just cleans up a connection
    // nobody ever answered, after a generous window.
    const sessionTimer = setTimeout(() => {
        if (!isolate.isDisposed) {
            ws.send(JSON.stringify({ type: 'error', text: 'Session expirée (délai maximal atteint).' }));
            isolate.dispose();
        }
    }, MAX_SESSION_MS);

    function clearWatchdogs() {
        clearInterval(flushTimer);
        clearInterval(cpuWatchdog);
        clearTimeout(sessionTimer);
    }

    // Host-side callbacks exposed into the isolate. These run OUTSIDE the
    // isolate (real Node), so it's safe to touch the ws here.
    await jail.set(
        '__output',
        new ivm.Reference((text) => {
            if (outputTruncated) return;
            outputLineCount += 1;
            if (outputLineCount > MAX_OUTPUT_LINES) {
                outputTruncated = true;
                flushOutput();
                ws.send(JSON.stringify({
                    type: 'error',
                    text: `Sortie trop volumineuse (> ${MAX_OUTPUT_LINES} lignes) — exécution arrêtée.`,
                }));
                // Dispose is deferred via setImmediate rather than called inline:
                // we're currently inside a synchronous callback invoked BY the
                // isolate (via applySyncPromise), so disposing immediately would
                // tear down the isolate while it's still on the call stack.
                setImmediate(() => { if (!isolate.isDisposed) isolate.dispose(); });
                return;
            }
            outputBuffer.push(text);
        })
    );
    await jail.set(
        '__error',
        new ivm.Reference((text) => {
            ws.send(JSON.stringify({ type: 'error', text }));
        })
    );
    await jail.set(
        '__input',
        new ivm.Reference((promptText) => {
            ws.send(JSON.stringify({ type: 'input-request', prompt: promptText }));
            return new Promise((resolve) => {
                state.pendingInputResolve = resolve;
            });
        })
    );

    let exitCode = 0;
    try {
        const script = await isolate.compileScript(buildIsolateScript(compiledJs));
        // No `timeout` here anymore — the CPU watchdog and session backstop
        // above handle termination instead, so a script legitimately waiting
        // on input() isn't punished for however long the user takes to answer.
        // `promise: true` is still essential: without it, script.run() resolves
        // as soon as the SYNCHRONOUS portion of the script finishes (almost
        // immediately for an async IIFE), before any awaited input() settles.
        await script.run(context, { promise: true });
    } catch (e) {
        // Covers compile errors and forced termination from the watchdogs above
        // (isolate.dispose() rejects the in-flight script.run() promise).
        ws.send(JSON.stringify({ type: 'error', text: e.message }));
        exitCode = 1;
    } finally {
        clearWatchdogs();
        flushOutput();
        if (!isolate.isDisposed) isolate.dispose();
        activeByWs.delete(ws);
        ws.send(JSON.stringify({ type: 'done', code: exitCode }));
    }
}


export { startRunIsolated, activeByWs, compileTsToJs };