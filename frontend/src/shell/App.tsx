import { useState, useRef, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom"
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav"
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl"
import { Badge } from "@astryxdesign/core/Badge"
import { Text } from "@astryxdesign/core/Text"
import CodeEditor from "../editor/editor"
import OutputConsole from "../console/OutputConsole"
import BlocksView from "../blocks/BlocksView"
import { NaturalLangPanel } from "../natural-lang/NaturalLangPanel.tsx"
import type { LogEntry } from "../console/OutputConsole"
import "./App.css"
import {useAstStore, SyncButton} from "../sync";
import {Decrompress} from "../editor/compressing.ts";
import { ApiKeyInput } from '../api';

export const DEFAULT_CODE : string = `// Bienvenue dans l'éditeur de code !
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
  console.log(\`Âge: \${age} - Majeur\`);
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
  const handleStop = () => editorControlsRef.current?.stop()
  const handleClear = () => {
    setLogs([])
    handleInputCancel()
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
  const navigate = useNavigate()

  // CodeEditor doit rester monté sur les vues "full" et "code"
  const showCodeEditor = activeView === 'full' || activeView === 'code'
  // BlocksView doit rester monté sur les vues "full" et "blocks"
  const showBlocksView = activeView === 'full' || activeView === 'blocks'
  // NaturalLangPanel doit rester monté sur les vues "full" et "text"
  const showNaturalLangPanel = activeView === 'full' || activeView === 'text'
  // OutputConsole doit rester monté sur toutes les vues (il est toujours affiché quelque part)
  // -> une seule instance permanente, jamais démontée tant que MainLayout est monté

  return (
    <div className="app-container">
      {/* Barre de navigation Astryx : titre, sélecteur de vue, bouton de sync. */}
      <TopNav
        label="Navigation principale"
        heading={<TopNavHeading heading="PFE 2026" superheading="Éditeur multi-vues" />}
        startContent={
          <SegmentedControl
            value={activeView}
            onChange={(v) => navigate(`/${v}`)}
            label="Vue active"
            size="sm"
          >
            <SegmentedControlItem value="full" label="Vue complète" />
            <SegmentedControlItem value="code" label="Éditeur de code" />
            <SegmentedControlItem value="blocks" label="Blocs visuels" />
            <SegmentedControlItem value="text" label="Langage naturel" />
          </SegmentedControl>
        }
        endContent={<SyncButton />}
      />

      {/* Contenu principal basé sur la route */}
      {/* Grille unique et persistante : les 4 panneaux + la console sont de VRAIS enfants directs
          du même conteneur grid en permanence. Seule la classe "view-*" change la disposition
          (grid-template-areas) ; aucun composant n'est jamais démonté lors du changement d'onglet. */}
      <div className={`main-content view-grid view-${activeView}`}>
        {/* --- Panneau Éditeur de code --- */}
        <div
          className="panel panel-code grid-item-code"
          style={{ display: showCodeEditor ? undefined : 'none' }}
        >
          <div className="panel-header">
            <Text type="label" weight="semibold">Éditeur de code</Text>
            <Badge variant="blue" label="Équipe B — Justin & Erwan" />
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
            />
          </div>
        </div>

        {/* --- Panneau Blocs Visuels --- */}
        <div
          className="panel panel-blocks grid-item-blocks"
          style={{ display: showBlocksView ? undefined : 'none' }}
        >
          <div className="panel-header">
            <Text type="label" weight="semibold">Blocs visuels</Text>
            <Badge variant="purple" label="Équipe A — Adel & Junior" />
          </div>
          <div className="panel-content">
            <BlocksView />
          </div>
        </div>

        {/* --- Panneau Langage Naturel --- */}
        <div
          className="panel panel-text grid-item-text"
          style={{ display: showNaturalLangPanel ? undefined : 'none' }}
        >
          <div className="panel-header">
            <Text type="label" weight="semibold">Langage naturel</Text>
            {/* Clé API Claude : rattachée à la vue qui l'utilise (plus d'overlay
                fixe qui chevauchait le bouton de synchronisation). */}
            <ApiKeyInput />
          </div>
          <div className="panel-content">
            <NaturalLangPanel />
          </div>
        </div>

        {/* --- Console de sortie : une seule instance, toujours montée, jamais recréée --- */}
        <div className="panel panel-console grid-item-console">
          <div className="panel-header">
            <Text type="label" weight="semibold">Console d'exécution</Text>
            <Badge variant="teal" label="Équipe B — Justin & Erwan" />
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
            />
          </div>
        </div>
      </div>

      {/* Pied de page compact (une seule ligne) */}
      <footer className="app-footer">
        <div className="footer-content">
          <Text type="supporting" size="xsm">PFE 2026 — Génie logiciel et des TI, ÉTS</Text>
          <Text type="supporting" size="xsm">•</Text>
          <Text type="supporting" size="xsm">{source.length > 0 ? `${source.length} caractères` : 'vide'}</Text>
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
        <Route path="/*" element={<MainLayout />} />
      </Routes>
    </Router>
  )
}

export default App