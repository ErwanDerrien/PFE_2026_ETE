import { useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useAstStore } from '../sync';

function CodeEditor() {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    
    const source = useAstStore((s) => s.source);
    const lastOrigin = useAstStore((s) => s.lastOrigin);
    const setSource = useAstStore((s) => s.setSource);
    const [output, setOutput] = useState("");



    //Reference a l'editeur et monaco 
    function handleEditorDidMount(editor: editor.IStandaloneCodeEditor, monaco : any) {
        editorRef.current = editor;
    }

    //Pour obtenir la valeur lors d'un changement dans le code
    function handleEditorChange(value?: string) {
        if (!value) return;
        setSource(value, "editor");
    }

    //Pour obtenir la valeur lors de l'activation d'un bouton
    function showValue() {
        alert(editorRef.current?.getValue());
    }

    //Gestion des erreurs. Une marker est une erreur trouver
    function handleEditorValidation(markers : any) {
        // model markers
        markers.forEach((marker : any) => console.log(`ERROR [Line ${marker.startLineNumber}] : ${marker.message}`));
    }

    function runCode(){
        console.log("Running code...")
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",
            }}
        >
            <div
                style={{
                    padding: 10,
                }}
            >
                <button
                    onClick={showValue}
                >
                    Run
                </button>
            </div>

            <Editor
                height="100%"
                language="typescript"
                value={
                    lastOrigin === "editor"
                        ? undefined
                        : source
                }
                theme="vs-dark"
                onMount={
                    handleEditorDidMount
                }
                onChange={
                    handleEditorChange
                }
                onValidate={
                    handleEditorValidation
                }
            />
        </div>
    );
}

export default CodeEditor;