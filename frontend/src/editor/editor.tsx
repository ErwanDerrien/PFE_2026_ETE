import { useRef } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";

function CodeEditor() {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

    //Reference a l'editeur et monaco 
    function handleEditorDidMount(editor: editor.IStandaloneCodeEditor, monaco : any) {
    editorRef.current = editor;
    }

    //Pour obtenir la valeur lors d'un changement dans le code
    function handleEditorChange(value : any, event : any) {
    console.log(value);
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

    return (
    <>
        <button onClick={showValue}>Show value</button>
        <Editor
        height="90vh"
        defaultLanguage="typescript"
        defaultValue="// some comment"
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        onValidate={handleEditorValidation}
        theme="vs-dark"
        />
    </>
    );
}

export default CodeEditor;