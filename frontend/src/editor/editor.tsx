import { useRef, useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { useAstStore } from '../sync';
import { DEFAULT_CODE } from '../shell/App';
import type { LogEntry } from '../console/OutputConsole';
import { Compress } from './compressing';

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
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
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
    const lastOrigin = useAstStore((s) => s.lastOrigin);
    const setSource = useAstStore((s) => s.setSource);

    // Notify parent when logs change
    useEffect(() => {
        onLogsChange?.(logs);
    }, [logs, onLogsChange]);

    // Notify parent when run state changes
    useEffect(() => {
        onRunStateChange?.(isRunning);
    }, [isRunning, onRunStateChange]);

    // Écouter les messages du sandbox
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'console') {
                setLogs(prev => [...prev, {
                    level: event.data.level,
                    text: event.data.args.join(' '),
                    timestamp: Date.now(),
                }]);
            } else if (event.data?.type === 'execution-done') {
                setIsRunning(false);
            } else if (event.data?.type === 'request-input') {
                if (onInputRequest) {
                    onInputRequest(event.data.prompt || 'Input: ').then((value) => {
                        if (iframeRef.current?.contentWindow) {
                            iframeRef.current.contentWindow.postMessage({ type: 'input-response', value }, '*');
                        }
                    });
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [onInputRequest]);

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

    // Exécuter le code
    const runCode = useCallback(() => {
        const code = editorRef.current?.getValue();
        if (!code) return;
        setLogs([]);
        setIsRunning(true);
        iframeRef.current?.contentWindow?.postMessage({ type: 'run', code }, '*');
    }, []);

    // Arrêter l'exécution
    const stopExecution = useCallback(() => {
        setIsRunning(false);
        iframeRef.current?.contentWindow?.postMessage({ type: 'stop' }, '*');
    }, []);

    // Exporter le code
    const exportCode = useCallback(() => {
        const code = editorRef.current?.getValue();
        if (!code) return;
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'code.js';
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
                <button onClick={handleImportFile} title="Import JS/TS file" style={{ background: "#4a5", color: "#fff", border: "none", borderRadius: "3px", padding: "4px 8px", cursor: "pointer", fontSize: "13px" }}>
                    📁 Import
                </button>
                <button onClick={() => setTheme(prev => prev === 'vs-dark' ? 'light' : 'vs-dark')} title="Toggle theme" style={{ background: "#444", color: "#fff", border: "none", borderRadius: "3px", padding: "4px 8px", cursor: "pointer", fontSize: "13px" }}>
                    {theme === 'vs-dark' ? '🌙' : '☀️'}
                </button>
                <label style={{ color: '#ccc', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#888' }}>A</span>
                    <input type="range" min={10} max={24} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ cursor: 'pointer' }} />
                </label>
                <button onClick={exportCode} title="Export code to file" style={{ background: "#666", color: "#fff", border: "none", borderRadius: "3px", padding: "4px 10px", cursor: "pointer", fontSize: "13px" }}>
                    ⬇ Export
                </button>
                <button onClick={handleShare} title="Compresser l'état et copier l'URL" style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", fontSize: "13px", fontFamily: "inherit", cursor: "pointer", borderRadius: "3px", border: "1px solid #555", backgroundColor: copied ? "#1a472a" : "#2d2d2d", color: copied ? "#4ade80" : "#ccc", transition: "background-color 0.2s, color 0.2s" }}>
                    {copied ? "✓ Copié !" : "🔗 Partager"}
                </button>
            </div>
            {/* Éditeur */}
            <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                    height="100%"
                    language="javascript"
                    defaultValue={DEFAULT_CODE}
                    value={lastOrigin === "editor" ? undefined : source}
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

            {/* Sandbox iframe caché */}
            <iframe
                ref={iframeRef}
                src="/sandbox.html"
                sandbox="allow-scripts"
                style={{ display: "none" }}
                title="code-sandbox"
            />
        </div>
    );
}

export default CodeEditor;