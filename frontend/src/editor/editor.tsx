import { useRef } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";

interface CodeEditorProps {
  onChange?: (value: string) => void;
}

function CodeEditor({ onChange }: CodeEditorProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

    // Reference a l'editeur
    function handleEditorDidMount(editor: editor.IStandaloneCodeEditor) {
        editorRef.current = editor;
    }

    // Pour obtenir la valeur lors d'un changement dans le code
    function handleEditorChange(value: string | undefined) {
        if (onChange && value !== undefined) {
            onChange(value);
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
            defaultValue={`// Mini-démo - Éditeur de code + Console d'exécution
// Ce code de démonstration peut être facilement modifié ou supprimé

console.log("=== Démonstration de l'exécution sandbox ===");

// Exemple 1: Fonctions de base (JavaScript pur)
function saluer(nom) {
  return \`Bonjour \${nom}!\`;
}

console.log(saluer("Étudiant"));
console.log("");

// Exemple 2: Opérations mathématiques
function calculerSurface(rayon) {
  return Math.PI * rayon * rayon;
}

const rayon = 5;
const surface = calculerSurface(rayon);
console.log(\`Surface d'un cercle de rayon \${rayon} = \${surface.toFixed(2)}\`);
console.log("");

// Exemple 3: Tableaux et boucles
const nombres = [1, 2, 3, 4, 5];
console.log("Nombres:", nombres);

let somme = 0;
for (const n of nombres) {
  somme += n;
}
console.log(\`Somme des nombres = \${somme}\`);
console.log("");

// Exemple 4: Conditions
const age = 20;
if (age >= 18) {
  console.log(\`Âge: \${age} - Majeur\`);
} else {
  console.log(\`Âge: \${age} - Mineur\`);
}

console.log("=== Fin de la démonstration ===");
console.log("Modifiez ce code et cliquez sur 'Exécuter le code' pour tester!");`}
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