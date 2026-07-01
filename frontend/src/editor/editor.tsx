import { useRef, useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { useAstStore } from '../sync';
import { DEFAULT_CODE } from '../shell/App';
import type { LogEntry } from '../console/OutputConsole';

interface CodeEditorProps {
  onChange?: (value: string) => void;
  onLogsChange?: (logs: LogEntry[]) => void;
  isRunning?: boolean;
  onRunStateChange?: (isRunning: boolean) => void;
  onInputRequest?: (prompt: string) => Promise<string>;
}

function CodeEditor({ onChange, onLogsChange, isRunning: _externalIsRunning, onRunStateChange, onInputRequest }: CodeEditorProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<Monaco | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isRunning, setIsRunning] = useState(false);
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
                // Utiliser la callback du parent pour gérer l'input
                if (onInputRequest) {
                    onInputRequest(event.data.prompt || 'Input: ').then((value) => {
                        if (iframeRef.current?.contentWindow) {
                            iframeRef.current.contentWindow.postMessage({
                                type: 'input-response',
                                value: value
                            }, '*');
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
        // appliquer thème et taille initiale
        try {
            monaco.editor.setTheme(theme);
            editor.updateOptions({ fontSize });
        } catch (e) {
            // ignore si monaco non prêt
        }
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
        if (iframeRef.current) {
            iframeRef.current.contentWindow?.postMessage({ type: 'stop' }, '*');
        }
    }, []);

    // Exporter le code
    const exportCode = useCallback(() => {
        const code = editorRef.current?.getValue();
        if (!code) return;
        
        const filename = 'code.js';
        
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    // Clear console logs
    const handleClearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    // Import fichier JS/TS
    const handleImportFile = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

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

        // Reset input
        event.target.value = '';
    }, [setSource]);

    // Appliquer thème quand il change
    useEffect(() => {
        try {
            if (monacoRef.current) monacoRef.current.editor.setTheme(theme);
        } catch (e) {}
        localStorage.setItem('editorTheme', theme);
    }, [theme]);

    // Appliquer fontSize quand il change
    useEffect(() => {
        try {
            if (editorRef.current) editorRef.current.updateOptions({ fontSize });
        } catch (e) {}
        localStorage.setItem('editorFontSize', String(fontSize));
    }, [fontSize]);

    // Pour obtenir la valeur lors d'un changement dans le code
    function handleEditorChange(value: string | undefined) {
        if (value !== undefined) {
            // Mettre à jour le store AST
            setSource(value, "editor");
            // Notifier le parent (App.tsx) pour la console
            if (onChange) {
                onChange(value);
            }
        }
    }

    // Gestion des erreurs
    function handleEditorValidation(markers: any[]) {
        markers.forEach((marker: any) => console.log(`ERROR [Line ${marker.startLineNumber}]: ${marker.message}`));
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Input file caché */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".js,.ts,.jsx,.tsx"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {/* Toolbar */}
            <div style={{
                padding: "8px 12px",
                background: "#2d2d2d",
                borderBottom: "1px solid #3e3e3e",
                display: "flex",
                alignItems: "center",
                gap: "12px",
            }}>
                
                <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: 'center' }}>
                    {/* Import button */}
                    <button
                        onClick={handleImportFile}
                        title="Import JS/TS file"
                        style={{
                            background: "#4a5",
                            color: "#fff",
                            border: "none",
                            borderRadius: "3px",
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: "13px",
                        }}
                    >
                        📁 Import
                    </button>

                    {/* Theme toggle */}
                    <button
                        onClick={() => setTheme(prev => prev === 'vs-dark' ? 'light' : 'vs-dark')}
                        title="Toggle theme"
                        style={{
                            background: "#444",
                            color: "#fff",
                            border: "none",
                            borderRadius: "3px",
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: "13px",
                        }}
                    >
                        {theme === 'vs-dark' ? '🌙' : '☀️'}
                    </button>

                    {/* Font size slider */}
                    <label style={{ color: '#ccc', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#888' }}>A</span>
                        <input
                            type="range"
                            min={10}
                            max={24}
                            value={fontSize}
                            onChange={(e) => setFontSize(Number(e.target.value))}
                            style={{ cursor: 'pointer' }}
                        />
                    </label>

                    <button
                        onClick={handleClearLogs}
                        title="Clear console"
                        style={{
                            background: "#555",
                            color: "#fff",
                            border: "none",
                            borderRadius: "3px",
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: "13px",
                        }}
                    >
                        ✖ Clear
                    </button>

                    <button
                        onClick={exportCode}
                        title="Export code to file"
                        style={{
                            background: "#666",
                            color: "#fff",
                            border: "none",
                            borderRadius: "3px",
                            padding: "4px 10px",
                            cursor: "pointer",
                            fontSize: "13px",
                        }}
                    >
                        ⬇ Export
                    </button>
                    
                    {isRunning ? (
                        <button
                            onClick={stopExecution}
                            title="Stop execution"
                            style={{
                                background: "#f48771",
                                color: "#fff",
                                border: "none",
                                borderRadius: "3px",
                                padding: "4px 14px",
                                cursor: "pointer",
                                fontSize: "13px",
                            }}
                        >
                            ⏹ Stop
                        </button>
                    ) : (
                        <button
                            onClick={runCode}
                            title="Execute code"
                            style={{
                                background: "#0e639c",
                                color: "#fff",
                                border: "none",
                                borderRadius: "3px",
                                padding: "4px 14px",
                                cursor: "pointer",
                                fontSize: "13px",
                            }}
                        >
                            ▶ Run
                        </button>
                    )}
                </div>
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