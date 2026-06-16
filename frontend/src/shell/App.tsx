import { useState } from "react"
import CodeEditor from "../editor/editor"
import Console from "../console/Console"
import "./App.css"

function App() {
  // État initial vide - l'éditeur fournira la valeur initiale via son defaultValue
  const [code, setCode] = useState<string>("")

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value)
    }
  }

  const handleExecute = () => {
    console.log("Code exécuté:", code.substring(0, 100) + "...")
  }

  const handleClearConsole = () => {
    console.log("Console vidée")
  }

  return (
    <div className="app-container">
      <div className="main-content">
        <div className="editor-wrapper">
          <CodeEditor onChange={handleEditorChange} />
        </div>
        
        <div className="console-wrapper">
          <Console 
            code={code}
            onExecute={handleExecute}
            onClear={handleClearConsole}
          />
        </div>
      </div>
    </div>
  )
}

export default App
