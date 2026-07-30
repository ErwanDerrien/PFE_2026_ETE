import { useState, useRef, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom"
import CodeEditor from "../editor/editor"
import OutputConsole from "../console/OutputConsole"
import BlocksView from "../blocks/BlocksView"
import { NaturalLangPanel } from "../natural-lang/NaturalLangPanel.tsx"
import type { LogEntry } from "../console/OutputConsole"
import "./App.css"
import {useAstStore, SyncButton} from "../sync";
import {Decrompress} from "../editor/compressing.ts";
import { ApiKeyInput } from '../api';
import { Theme } from '@astryxdesign/core';
import { stoneTheme } from '@astryxdesign/theme-stone/built';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Icon } from '@astryxdesign/core/Icon';
import { Sun, Moon } from 'lucide-react';

export const DEFAULT_CODE: string = `
// Bienvenue dans l'éditeur de code !
// Appuyez sur "Run" pour exécuter ce code
console.log("=== Démonstration - Exécution TypeScript ===");

// Exemple 1: Fonctions de base
function saluer(nom: string): string {
  return \`Bonjour \${nom}!\`;
}

console.log(saluer("Étudiant"));

// Exemple 2: Opérations mathématiques
function calculerSurface(rayon: number): number {
  return Math.PI * rayon * rayon;
}

const rayon: number = 5;
const surface: number = calculerSurface(rayon);
console.log(\`Surface d'un cercle de rayon \${rayon} = \${surface.toFixed(2)}\`);

// Exemple 3: Tableaux et boucles
const nombres: number[] = [1, 2, 3, 4, 5];

console.log("Nombres:", nombres);

let somme: number = 0;
for (const n of nombres) {
  somme += n;
}
console.log(\`Somme des nombres = \${somme}\`);

// Exemple 4: Conditions
const age: number = 20;
if (age >= 18) {
  console.log(\`Âge: \${age} - Majeur ✓\`);
} else {
  console.log(\`Âge: \${age} - Mineur\`);
}

// Exemple 5: Objets et destructuring
interface Personne {
  nom: string;
  age: number;
  ville: string;
}

const personne: Personne = {
  nom: "Alice",
  age: 25,
  ville: "Montréal",
};

const { nom, age: personneAge, ville } = personne;

console.log(\`\${nom} habite à \${ville}\`);
console.log(\`\${nom} a \${personneAge} ans.\`);

// Exemple 6: Map et Filter
const resultats: number[] = nombres
  .map((n: number) => n * 2)
  .filter((n: number) => n > 4);

console.log("Nombres doublés et filtrés:", resultats);

// Exemple 7: Input utilisateur (fonction input() disponible)
const nomUtilisateur: string | null = await input("Quel est votre nom?");

if (nomUtilisateur) {
  console.log(\`Bienvenue \${nomUtilisateur}!\`);
} else {
  console.log("Vous avez annulé la saisie.");
}

console.log("=== Exécution terminée avec succès! ===");
`;

// Composant pour le layout principal avec onglets
function MainLayout({
  mode,
  onToggleMode,
}: {
  mode: 'light' | 'dark';
  onToggleMode: () => void;
}) {
  const location = useLocation()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isWaitingForInput, setIsWaitingForInput] = useState(false)
  const [inputPrompt, setInputPrompt] = useState('')
  const inputResolveRef = useRef<((value: string) => void) | null>(null)
  const editorControlsRef = useRef<{ run: () => void; stop: () => void } | null>(null)

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

  const handleRegisterControls = (controls: { run: () => void; stop: () => void }) => {
    editorControlsRef.current = controls
  }

  const handleRun = () => editorControlsRef.current?.run()
  const handleStop = () => {
    handleInputCancel();
    editorControlsRef.current?.stop();
  }
  const handleClear = () => setLogs([])

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

  // CodeEditor doit rester monté sur les vues "full" et "code"
  const showCodeEditor = activeView === 'full' || activeView === 'code'
  // BlocksView doit rester monté sur les vues "full" et "blocks"
  const showBlocksView = activeView === 'full' || activeView === 'blocks'
  // NaturalLangPanel doit rester monté sur les vues "full" et "text"
  const showNaturalLangPanel = activeView === 'full' || activeView === 'text'
  // OutputConsole doit rester monté sur toutes les vues (il est toujours affiché quelque part)
  // -> une seule instance permanente, jamais démontée tant que MainLayout est monté

  const tabActiveStyle: React.CSSProperties =
    mode === 'dark'
      ? { 
          backgroundColor: '#DFE2E5',
          borderColor: '#DFE2E5',
          color: '#0A1317'
        }
      : {
          backgroundColor: '#4f8fc7',
          borderColor: '#4f8fc7',
          color: '#ffffff'
        };
  const tabStyle = (view: string): React.CSSProperties | undefined =>
    activeView === view ? tabActiveStyle : undefined;

  return (
    <div className="app-container" data-mode={mode}>
      {/* Barre de navigation compacte (une seule ligne : titre, onglets, sync) */}
      <nav className="app-nav">
        <div className="nav-title">
          <h1>PFE 2026 — Éditeur Multi-vues</h1>
        </div>

        <div className="nav-tabs">
          <Link
            to="/full"
            className={`nav-tab ${activeView === 'full' ? 'active' : ''}`}
            style={tabStyle('full')}
          >
            Vue complète
          </Link>
          <Link
            to="/code"
            className={`nav-tab ${activeView === 'code' ? 'active' : ''}`}
            style={tabStyle('code')}
          >
            Éditeur de code
          </Link>
          <Link
            to="/blocks"
            className={`nav-tab ${activeView === 'blocks' ? 'active' : ''}`}
            style={tabStyle('blocks')}
          >
            Blocs visuels
          </Link>
          <Link
            to="/text"
            className={`nav-tab ${activeView === 'text' ? 'active' : ''}`}
            style={tabStyle('text')}
          >
            Langage naturel
          </Link>
        </div>

        {/* Bouton global de synchronisation entre les vues (équipe A) */}
        <div className="nav-sync">
          <IconButton
            label={mode === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'}
            onClick={onToggleMode}
            icon={<Icon icon={mode === 'light' ? Moon : Sun} />}
            size="sm"
          />
          <SyncButton />
        </div>
      </nav>

      {/* Contenu principal basé sur la route */}
      <div className={`main-content view-grid view-${activeView}`}>
        {/* --- Panneau Éditeur de code --- */}
        <div
          className="panel panel-code grid-item-code"
          style={{ display: showCodeEditor ? undefined : 'none' }}
        >
          <div className="panel-header">
            <h3>Éditeur de code</h3>
          </div>
          <div className="panel-content">
            <CodeEditor
              onChange={handleEditorChange}
              onLogsChange={setLogs}
              isRunning={isRunning}
              onRunStateChange={setIsRunning}
              onInputRequest={handleInputRequest}
              onInputCancel={handleInputCancel}
              onRegisterControls={handleRegisterControls}
              mode={mode}
            />
          </div>
        </div>

        {/* --- Panneau Blocs Visuels --- */}
        <div
          className="panel panel-blocks grid-item-blocks"
          data-mode={mode}
          style={{ display: showBlocksView ? undefined : 'none' }}
        >
          <div className="panel-header">
            <h3>Blocs visuels</h3>
          </div>
          <div className="panel-content">
            <BlocksView mode={mode}/>
          </div>
        </div>

        {/* --- Panneau Langage Naturel --- */}
        <div
          className="panel panel-text grid-item-text"
          style={{ display: showNaturalLangPanel ? undefined : 'none' }}
        >
          <div className="panel-header">
            <h3>Langage naturel</h3>
            <ApiKeyInput />
          </div>
          <div className="panel-content">
            <NaturalLangPanel />
          </div>
        </div>

        {/* --- Console de sortie : une seule instance, toujours montée, jamais recréée --- */}
        <div className="panel panel-console grid-item-console">
          <div className="panel-header">
            <h3>Console d'exécution</h3>
          </div>
          <div className="panel-content">
            <OutputConsole
              logs={logs}
              isWaitingForInput={isWaitingForInput}
              inputPrompt={inputPrompt}
              onInputSubmit={handleInputSubmit}
              onInputCancel={handleInputCancel}
              isRunning={isRunning}
              onRun={handleRun}
              onStop={handleStop}
              onClear={handleClear}
              mode={mode}
            />
          </div>
        </div>
      </div>

      {/* Pied de page compact (une seule ligne) */}
      <footer className="app-footer">
        <div className="footer-content">
          <span>PFE 2026 — Génie logiciel et des TI, ÉTS</span>
        </div>
      </footer>
    </div>
  )
}

// Composant App principal avec Router 
function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');

  return (
    <Theme theme={stoneTheme} mode={mode}>
      <Router>
        <Routes>
          <Route
            path="/*"
            element={
              <MainLayout
                mode={mode}
                onToggleMode={() => setMode((m) => (m === 'light' ? 'dark' : 'light'))}
              />
            }
          />
        </Routes>
      </Router>
    </Theme>
  )
}

export default App