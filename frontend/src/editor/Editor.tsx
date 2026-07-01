import { useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useAstStore } from '../sync';
import { Compress } from './compressing';

interface CodeEditorProps {
    onChange?: (value: string) => void;
}



function CodeEditor({ onChange }: CodeEditorProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const [copied, setCopied] = useState(false);

    const source = useAstStore((s) => s.source);
    const lastOrigin = useAstStore((s) => s.lastOrigin);
    const setSource = useAstStore((s) => s.setSource);

    // Reference a l'editeur
    function handleEditorDidMount(editor: editor.IStandaloneCodeEditor) {
        editorRef.current = editor;
        const currentValue = editor.getValue();
        if (currentValue) {
            setSource(currentValue, "editor");
        }
    }

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

    // Compresse l'état complet du store dans l'URL et copie dans le presse-papiers
    function handleShare() {
        const appState = useAstStore.getState();
        Compress(appState);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                padding: "4px 8px",
                backgroundColor: "#1e1e1e",
                borderBottom: "1px solid #333",
                flexShrink: 0,
            }}>
                <button
                    onClick={handleShare}
                    title="Compresser l'état et copier l'URL"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 12px",
                        fontSize: "12px",
                        fontFamily: "inherit",
                        cursor: "pointer",
                        borderRadius: "4px",
                        border: "1px solid #555",
                        backgroundColor: copied ? "#1a472a" : "#2d2d2d",
                        color: copied ? "#4ade80" : "#ccc",
                        transition: "background-color 0.2s, color 0.2s",
                    }}
                >
                    {copied ? "✓ Lien copié !" : "🔗 Partager"}
                </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
                <Editor
                    height="100%"
                    defaultLanguage="javascript"
                    value={source}
                    onMount={handleEditorDidMount}
                    onChange={handleEditorChange}
                    onValidate={handleEditorValidation}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
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