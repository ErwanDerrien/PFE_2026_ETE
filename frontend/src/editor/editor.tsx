import { useRef, useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { useAstStore } from '../sync';
import type { LogEntry } from '../console/OutputConsole';
import { Compress } from './compressing';
import { TOOLBAR_BUTTON_BASE_STYLE, TOOLBAR_ICON_BUTTON_STYLE } from '../shared';

// Backend d'exécution TypeScript interactif (voir backend/index.js, WS /run-ws).
// Override possible via VITE_BACKEND_URL en production.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const BACKEND_WS_URL = BACKEND_URL.replace(/^http/, 'ws') + '/run-ws';

interface CodeEditorProps {
    onChange?: (value: string) => void;
    onLogsChange?: (logs: LogEntry[]) => void;
    isRunning?: boolean;
    onRunStateChange?: (isRunning: boolean) => void;
    onInputRequest?: (prompt: string) => Promise<string>;
    onInputCancel?: () => void;
    onRegisterControls?: (controls: { run: () => void; stop: () => void }) => void;
}

function CodeEditor({ onChange, onLogsChange, isRunning: _externalIsRunning, onRunStateChange, onInputRequest, onInputCancel: _onInputCancel, onRegisterControls }: CodeEditorProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [copied, setCopied] = useState(false);
    const [theme, setTheme] = useState<string>(() => localStorage.getItem('editorTheme') || 'vs-dark');
    const [fontSize, setFontSize] = useState<number>(() => {
        const v = Number(localStorage.getItem('editorFontSize'));
        return Number.isFinite(v) && v > 8 ? v : 14;
    });

    const source = useAstStore((s) => s.source);
    const pendingSource = useAstStore((s) => s.pendingSource);
    const lastOrigin = useAstStore((s) => s.lastOrigin);
    const setSource = useAstStore((s) => s.setSource);

    // Fermer la connexion WebSocket si le composant est démonté en pleine exécution
    useEffect(() => {
        return () => {
            wsRef.current?.close();
        };
    }, []);

    // Notify parent when logs change
    useEffect(() => {
        onLogsChange?.(logs);
    }, [logs, onLogsChange]);

    // Notify parent when run state changes
    useEffect(() => {
        onRunStateChange?.(isRunning);
    }, [isRunning, onRunStateChange]);

    // Appelé avant que Monaco ne monte l'éditeur : configure le service TypeScript
    // pour qu'il corresponde à ce que le backend fait réellement (voir backend/index.js,
    // fonction buildMainTs) plutôt qu'à ce que Monaco croit être un script isolé.
    function handleEditorWillMount(monaco: Monaco) {
        // Déclare le input() global injecté par le runtime du backend, sinon Monaco
        // le signale comme "Cannot find name 'input'" (TS2304).
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
            'declare function input(prompt?: string): Promise<string>;',
            'ts:global-input.d.ts'
        );

        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            diagnosticCodesToIgnore: [
                1375, // 'await' au top-level nécessite un module (le backend enveloppe le code dans une IIFE async, donc ça s'exécute bien malgré l'avertissement)
                1378, // Top-level 'await' nécessite module ES2022+/target ES2017+ — même raison
            ],
        });
    }

    // Référence à l'éditeur et à Monaco
    function handleEditorDidMount(editor: editor.IStandaloneCodeEditor, monaco: Monaco) {
        editorRef.current = editor;
        monacoRef.current = monaco;
        const currentValue = editor.getValue();
        if (currentValue) {
            setSource(currentValue, "editor");
        }
        try {
            monaco.editor.setTheme(theme);
            editor.updateOptions({ fontSize });
        } catch (e) { /* ignore */ }
    }

    // Exécuter le code via le backend (WebSocket /run-ws) : connexion persistante,
    // sortie streamée en temps réel, et input() interactif relayé bidirectionnellement.
    const runCode = useCallback(() => {
        const code = editorRef.current?.getValue();
        if (!code) return;

        // Ferme toute connexion précédente encore ouverte avant d'en ouvrir une nouvelle
        wsRef.current?.close();

        setLogs([]);
        setIsRunning(true);

        const ws = new WebSocket(BACKEND_WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'run', code }));
        };

        ws.onmessage = (event) => {
            let msg: any;
            try {
                msg = JSON.parse(event.data);
            } catch {
                return;
            }

            if (msg.type === 'output') {
                const lines = (msg.text as string).split('\n').filter((l: string) => l.length > 0);
                if (lines.length > 0) {
                    setLogs(prev => [...prev, ...lines.map((text: string) => ({
                        level: 'log' as const,
                        text,
                        timestamp: Date.now(),
                    }))]);
                }
            } else if (msg.type === 'error') {
                setLogs(prev => [...prev, { level: 'error', text: msg.text, timestamp: Date.now() }]);
            } else if (msg.type === 'input-request') {
                if (onInputRequest) {
                    onInputRequest(msg.prompt || 'Input: ').then((value) => {
                        ws.send(JSON.stringify({ type: 'input', value }));
                    });
                } else {
                    // Personne n'écoute les demandes d'input : on répond vide pour ne pas bloquer le process serveur
                    ws.send(JSON.stringify({ type: 'input', value: '' }));
                }
            } else if (msg.type === 'done') {
                setIsRunning(false);
                ws.close();
            }
        };

        ws.onerror = () => {
            setLogs(prev => [...prev, {
                level: 'error',
                text: 'Erreur de connexion WebSocket avec le backend (vérifiez qu\'il tourne sur ' + BACKEND_URL + ').',
                timestamp: Date.now(),
            }]);
        };

        ws.onclose = () => {
            setIsRunning(false);
            if (wsRef.current === ws) wsRef.current = null;
        };
    }, [onInputRequest]);

    // Arrêter l'exécution : demande au serveur de tuer le processus enfant, puis ferme la connexion
    const stopExecution = useCallback(() => {
        wsRef.current?.send(JSON.stringify({ type: 'stop' }));
        wsRef.current?.close();
        setIsRunning(false);
    }, []);

    // Exporter le code
    const exportCode = useCallback(() => {
        const code = editorRef.current?.getValue();
        if (!code) return;
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'code.ts';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    // Import fichier JS/TS
    const handleImportFile = useCallback(() => fileInputRef.current?.click(), []);

    // Gérer la sélection de fichier
    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (editorRef.current) {
                editorRef.current.setValue(content);
                setSource(content, "editor");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }, [setSource]);

    // Partager: compresse l'état dans l'URL
    const handleShare = useCallback(() => {
        const appState = useAstStore.getState();
        Compress(appState);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, []);

    // Expose run/stop to parent
    useEffect(() => {
        onRegisterControls?.({ run: runCode, stop: stopExecution });
    }, [onRegisterControls, runCode, stopExecution]);

    // Appliquer thème quand il change
    useEffect(() => {
        try { if (monacoRef.current) monacoRef.current.editor.setTheme(theme); } catch (e) {}
        localStorage.setItem('editorTheme', theme);
    }, [theme]);

    // Appliquer fontSize quand il change
    useEffect(() => {
        try { if (editorRef.current) editorRef.current.updateOptions({ fontSize }); } catch (e) {}
        localStorage.setItem('editorFontSize', String(fontSize));
    }, [fontSize]);

    function handleEditorChange(value: string | undefined) {
        if (value !== undefined) {
            setSource(value, "editor");
            onChange?.(value);
        }
    }

    function handleEditorValidation(markers: any[]) {
        markers.forEach((marker: any) => console.log(`ERROR [Line ${marker.startLineNumber}]: ${marker.message}`));
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <input ref={fileInputRef} type="file" accept=".js,.ts,.jsx,.tsx" onChange={handleFileSelect} style={{ display: 'none' }} />

            {/* Barre d'outils */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px", padding: "4px 8px", backgroundColor: "#1e1e1e", borderBottom: "1px solid #333", flexShrink: 0, flexWrap: "wrap" }}>
                <button onClick={handleImportFile} title="Import JS/TS file" style={{ ...TOOLBAR_BUTTON_BASE_STYLE, background: "#4a5", color: "#fff" }}>
                    📁 Import
                </button>
                <button onClick={exportCode} title="Export code to file" style={{ ...TOOLBAR_BUTTON_BASE_STYLE, background: "#666", color: "#fff" }}>
                    ⬇ Export
                </button>
                <div style={{ width: '1px', height: '18px', background: '#333', margin: '0 2px' }} />
                <button onClick={() => setTheme(prev => prev === 'vs-dark' ? 'light' : 'vs-dark')} title="Toggle theme" style={{ ...TOOLBAR_ICON_BUTTON_STYLE, background: "#444", color: "#fff" }}>
                    {theme === 'vs-dark' ? '🌙' : '☀️'}
                </button>
                <label style={{ color: '#ccc', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#888' }}>A</span>
                    <input type="range" min={10} max={24} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ cursor: 'pointer' }} />
                </label>
                <button onClick={handleShare} title="Compresser l'état et copier l'URL" style={{ ...TOOLBAR_BUTTON_BASE_STYLE, gap: "6px", fontFamily: "inherit", border: "1px solid #555", backgroundColor: copied ? "#1a472a" : "#2d2d2d", color: copied ? "#4ade80" : "#ccc", transition: "background-color 0.2s, color 0.2s" }}>
                    {copied ? "Copié !" : "Partager"}
                </button>
            </div>
            {/* Éditeur */}
            <div className="nokey" style={{ flex: 1, minHeight: 0 }}>
                <Editor
                    height="100%"
                    language="typescript"
                    defaultValue={source}
                    value={lastOrigin === "editor" ? undefined : (pendingSource ?? source)}
                    beforeMount={handleEditorWillMount}
                    onMount={handleEditorDidMount}
                    onChange={handleEditorChange}
                    onValidate={handleEditorValidation}
                    theme={theme}
                    options={{
                        minimap: { enabled: false },
                        fontSize: fontSize,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        formatOnPaste: true,
                        formatOnType: true,
                        suggestOnTriggerCharacters: true,
                        acceptSuggestionOnEnter: "on",
                        tabSize: 2,
                        automaticLayout: true,
                    }}
                />
            </div>
        </div>
    );
}

export default CodeEditor;