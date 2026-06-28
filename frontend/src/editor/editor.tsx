import { useRef } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useAstStore } from '../sync';
import { DEFAULT_CODE } from '../shell/App'

interface CodeEditorProps {
  onChange?: (value: string) => void;
}



function CodeEditor({ onChange }: CodeEditorProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    
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

    return (
        <Editor
            height="100%"
            defaultLanguage="javascript"
            defaultValue={DEFAULT_CODE}
            value={lastOrigin === "editor" ? undefined : source}
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
    );
}

export default CodeEditor;