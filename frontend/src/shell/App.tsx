import { useState, useRef, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom"
import CodeEditor from "../editor/editor"
import OutputConsole from "../console/OutputConsole"
import BlocksView from "../blocks/BlocksView"
import NaturalLangView from "../natural-lang/NaturalLangView"
import type { LogEntry } from "../console/OutputConsole"
import "./App.css"
import {useAstStore} from "../sync";
import {Decrompress} from "../editor/compressing.ts";




export const DEFAULT_CODE : string = `// 🚀 Bienvenue dans l'Éditeur de Code!
// Appuyez sur "Run" pour exécuter ce code

console.log("=== Démonstration - Exécution JavaScript ===");

// Exemple 1: Fonctions de base
function saluer(nom) {
  return \`Bonjour \${nom}!\`;
}

console.log(saluer("Étudiant"));

// Exemple 2: Opérations mathématiques
function calculerSurface(rayon) {
  return Math.PI * rayon * rayon;
}

const rayon = 5;
const surface = calculerSurface(rayon);
console.log(\`Surface d'un cercle de rayon \${rayon} = \${surface.toFixed(2)}\`);

// Exemple 3: Tableaux et boucles
const nombres = [1, 2, 3, 4, 5];
console.log("Nombres:", nombres);

let somme = 0;
for (const n of nombres) {
  somme += n;
}
console.log(\`Somme des nombres = \${somme}\`);

// Exemple 4: Conditions
const age = 20;
if (age >= 18) {
  console.log(\`Âge: \${age} - Majeur ✓\`);
} else {
  console.log(\`Âge: \${age} - Mineur\`);
}

// Exemple 5: Objets et destructuring
const personne = { nom: 'Alice', age: 25, ville: 'Montréal' };
const { nom, personneAge = 30 } = personne;
console.log(\`\${nom} habite à \${personne.ville}\`);

// Exemple 6: Map et Filter
const resultats = nombres.map(n => n * 2).filter(n => n > 4);
console.log("Nombres doublés et filtrés:", resultats);

// Exemple 7: Input utilisateur (fonction input() disponible)
// Note: La fonction input() retourne une promesse, donc il faut utiliser await
const nom_utilisateur = await input('Quel est votre nom?');
if (nom_utilisateur) {
  console.log(\`Bienvenue \${nom_utilisateur}!\`);
} else {
  console.log('Vous avez annulé la saisie.');
}

console.log("=== Exécution terminée avec succès! ===");`;

// Composant pour le layout principal avec onglets
function MainLayout() {
  const location = useLocation()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isWaitingForInput, setIsWaitingForInput] = useState(false)
  const [inputPrompt, setInputPrompt] = useState('')
  const inputResolveRef = useRef<((value: string) => void) | null>(null)

  const source = useAstStore((s) => s.source);
  const setSource = useAstStore((s) => s.setSource);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setSource(value, "editor");

    }
  }

  const handleInputSubmit = (value: string) => {
    setIsWaitingForInput(false)
    if (inputResolveRef.current) {
      inputResolveRef.current(value)
      inputResolveRef.current = null
    }
  }

  const handleInputCancel = () => {
    setIsWaitingForInput(false)
    if (inputResolveRef.current) {
      inputResolveRef.current('')
      inputResolveRef.current = null
    }
  }

  const handleInputRequest = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      setInputPrompt(prompt)
      setIsWaitingForInput(true)
      inputResolveRef.current = resolve
    })
  }

  // Initialisation au montage : tente de restaurer depuis l'URL, sinon charge DEFAULT_CODE
  useEffect(() => {
    const restored = Decrompress();
    if (!restored) {
      // Pas de hash dans l'URL : on initialise le store avec le code par défaut
      setSource(DEFAULT_CODE, "editor");
    } else {
      setSource(restored?.source, "editor");
    }
  }, [setSource]);

  // Détermine quelle vue est active pour l'affichage des 4 onglets
  const activeView = location.pathname.substring(1) || "full"

  return (
    <div className="app-container">
      {/* Barre de navigation */}
      <nav className="app-nav">
        <div className="nav-title">
          <h1>PFE 2026 - Éditeur Multi-vues</h1>
          <div className="nav-subtitle">
            <span>Sous-équipe B: Éditeur & Console</span>
            <span>Sous-équipe A: Blocs Visuels</span>
            <span>Transversal: Langage Naturel</span>
          </div>
        </div>
        
        <div className="nav-tabs">
          <Link 
            to="/full" 
            className={`nav-tab ${activeView === 'full' ? 'active' : ''}`}
          >
            📊 Vue Complète (4 onglets)
          </Link>
          <Link 
            to="/code" 
            className={`nav-tab ${activeView === 'code' ? 'active' : ''}`}
          >
            💻 Éditeur de Code
          </Link>
          <Link 
            to="/blocks" 
            className={`nav-tab ${activeView === 'blocks' ? 'active' : ''}`}
          >
            🟦 Blocs Visuels
          </Link>
          <Link 
            to="/text" 
            className={`nav-tab ${activeView === 'text' ? 'active' : ''}`}
          >
            📝 Langage Naturel
          </Link>
        </div>
      </nav>

      {/* Contenu principal basé sur la route */}
      <div className="main-content">
        {activeView === 'full' && (
          <div className="four-panel-view">
            <div className="panel panel-code">
              <div className="panel-header">
                <h3>💻 Éditeur de Code</h3>
                <span className="panel-team">Équipe B: Justin & Erwan</span>
              </div>
              <div className="panel-content">
                <CodeEditor 
                  onChange={handleEditorChange}
                  onLogsChange={setLogs}
                  isRunning={isRunning}
                  onRunStateChange={setIsRunning}
                  onInputRequest={handleInputRequest}
                  onInputCancel={handleInputCancel}
                />
              </div>
            </div>

            <div className="panel panel-blocks">
              <div className="panel-header">
                <h3>🟦 Blocs Visuels</h3>
                <span className="panel-team">Équipe A: Adel & Junior</span>
              </div>
              <div className="panel-content">
                <BlocksView />
              </div>
            </div>
            
            <div className="panel panel-text">
              <div className="panel-header">
                <h3>📝 Langage Naturel</h3>
                <span className="panel-team">Émie (Transversal)</span>
              </div>
              <div className="panel-content">
                <NaturalLangView />
              </div>
            </div>
            
            <div className="panel panel-console">
              <div className="panel-header">
                <h3>📟 Console d'Exécution</h3>
                <span className="panel-team">Équipe B: Justin & Erwan</span>
              </div>
              <div className="panel-content">
                <OutputConsole 
                  logs={logs}
                  isWaitingForInput={isWaitingForInput}
                  inputPrompt={inputPrompt}
                  onInputSubmit={handleInputSubmit}
                  onInputCancel={handleInputCancel}
                />
              </div>
            </div>
          </div>
        )}

        {activeView === 'code' && (
          <div className="single-view">
            <div className="single-view-header">
              <h2>💻 Éditeur de Code</h2>
              <p>Interface de développement principale avec Monaco Editor</p>
            </div>
            <div className="single-view-content">
              <CodeEditor 
                onChange={handleEditorChange}
                onLogsChange={setLogs}
                isRunning={isRunning}
                onRunStateChange={setIsRunning}
                onInputRequest={handleInputRequest}
                onInputCancel={handleInputCancel}
              />
            </div>
            <div className="single-view-console">
              <OutputConsole 
                logs={logs}
                isWaitingForInput={isWaitingForInput}
                inputPrompt={inputPrompt}
                onInputSubmit={handleInputSubmit}
                onInputCancel={handleInputCancel}
              />
            </div>
          </div>
        )}

        {activeView === 'blocks' && (
          <div className="single-view">
            <div className="single-view-header">
              <h2>🟦 Blocs Visuels</h2>
              <p>Représentation graphique de la structure du code</p>
            </div>
            <div className="single-view-content">
              <BlocksView />
            </div>
            <div className="single-view-console">
              <OutputConsole logs={logs} />
            </div>
          </div>
        )}

        {activeView === 'text' && (
          <div className="single-view">
            <div className="single-view-header">
              <h2>📝 Langage Naturel</h2>
              <p>Conversion code ↔ description textuelle via API Claude</p>
            </div>
            <div className="single-view-content">
              <NaturalLangView />
            </div>
            <div className="single-view-console">
              <OutputConsole logs={logs} />
            </div>
          </div>
        )}
      </div>

      {/* Pied de page */}
      <footer className="app-footer">
        <div className="footer-content">
          <p>Projet de fin d'études - Département de génie logiciel et des TI - ÉTS 2026</p>
          <div className="footer-links">
            <span>Mode: {activeView === 'full' ? '4 onglets' : 'vue unique'}</span>
            <span>•</span>
            <span>Code source: {source.length > 0 ? `${source.length} caractères` : 'vide'}</span>
            <span>•</span>
            <span>Serveur: <a href="http://localhost:5173" target="_blank" rel="noopener noreferrer">localhost:5173</a></span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Composant App principal avec Router
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />} />
        <Route path="/full" element={<MainLayout />} />
        <Route path="/code" element={<MainLayout />} />
        <Route path="/blocks" element={<MainLayout />} />
        <Route path="/text" element={<MainLayout />} />
      </Routes>
    </Router>
  )
}

export default App
