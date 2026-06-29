/**
 * Contrat du moteur de synchronisation — le « médiateur central » du projet.
 *
 * L'AST Babel est la source de vérité. Les quatre transformations relient l'AST
 * aux trois représentations :
 *
 *        code (string)  ──parse()──▶  AST Babel  ──astToGraph()──▶  GraphModel (blocs)
 *        code (string)  ◀─generate()─  AST Babel  ◀─graphToAst()──  GraphModel (blocs)
 *
 * Les deux directions « faciles » sont fournies par Babel (parse/generate). Les
 * deux directions « cœur du projet » sont astToGraph (lecture) et graphToAst
 * (édition, la plus difficile) — propriété de l'équipe A.
 *
 * Ce fichier ne contient QUE des types (contrats). Les implémentations vivent
 * dans /sync. Lu par toutes les équipes.
 */

import type { File } from './ast';
import type { SupportedLanguage } from './ast';
import type { GraphModel, GraphNode, InsertTarget, SourceLoc } from './graph';

/** Options de transformation AST -> graphe (réglages de l'équipe A). */
export interface GraphOptions {
  /** Replier les sous-arbres d'expression courts en pastilles (« j*j »). */
  collapseExpressions?: boolean;
  /** Longueur max. du texte source pour replier en pastille (défaut ~15). */
  collapseMaxLength?: number;
  /** Regrouper les statements en phases via les lignes vides (Niveau 1). */
  groupByBlankLines?: boolean;
  /** IDs des nœuds de définition de fonction dont le corps est déplié. */
  expandedFunctions?: Set<string>;
}

// --- Les quatre transformations (signatures de contrat) ---

/** code -> AST. Fournie par `@babel/parser`. */
export type Parse = (source: string, language?: SupportedLanguage) => File;

/** AST -> code. Fournie par `@babel/generator`. */
export type Generate = (ast: File) => string;

/** AST -> graphe de blocs. Cœur en lecture (équipe A). */
export type AstToGraph = (ast: File, options?: GraphOptions) => GraphModel;

/**
 * graphe de blocs -> AST. Cœur en édition (équipe A) — la direction la plus dure.
 * `base` est l'AST courant : on le met à jour à partir des éditions du graphe
 * plutôt que de reconstruire à partir de zéro, ce qui aide à la stabilité du
 * round-trip (le « défi difficile » S -> D -> D' -> S').
 */
export type GraphToAst = (graph: GraphModel, base: File) => File;

/** L'ensemble des quatre transformations regroupées. */
export interface SyncEngine {
  parse: Parse;
  generate: Generate;
  astToGraph: AstToGraph;
  graphToAst: GraphToAst;
}

// --- État partagé (contrat du store, voir /sync/store.ts) ---

/**
 * Origine d'une édition. Le store mémorise la dernière origine pour qu'une vue
 * puisse ignorer ses propres modifications et éviter les boucles de
 * synchronisation (ex. l'éditeur ne se réécrit pas après avoir lui-même écrit).
 */
export type EditOrigin = 'editor' | 'blocks' | 'natural-lang' | 'system';

/** Phase où une erreur de synchronisation s'est produite. */
export type SyncPhase = 'parse' | 'astToGraph' | 'graphToAst' | 'generate';

/** Erreur de synchronisation remontée aux vues (console, soulignement éditeur...). */
export interface SyncError {
  phase: SyncPhase;
  message: string;
  loc?: SourceLoc;
}

/**
 * Forme de l'état du store AST partagé. Toutes les équipes lisent cet état ;
 * elles écrivent uniquement via les actions (qui réconcilient vers l'AST).
 */
export interface AstStoreState {
  // --- source de vérité ---
  /** L'AST Babel. `null` tant qu'aucun code valide n'a été parsé. */
  ast: File | null;
  /**
   * L'OBJET STRUCTURÉ persistant (`<global>` FunctionDeclaration), source de
   * vérité des blocs : les éditions de blocs le mutent, puis `graph`/`ast`/`source`
   * en sont re-dérivés. Typé `unknown` ici pour ne pas faire dépendre /shared de
   * /blocks ; le store le manipule comme `FunctionDeclaration`.
   */
  codeObj: unknown;

  // --- projections dérivées (maintenues à jour depuis `ast`/`codeObj`) ---
  /** Le code source courant (dérivé via generate, ou tel que saisi). */
  source: string;
  /** Le graphe de blocs courant (dérivé via objectToGraph). */
  graph: GraphModel;
  language: SupportedLanguage;
  /** Dernière erreur de sync, ou `null`. */
  error: SyncError | null;
  /** Origine de la dernière écriture (anti-boucle). */
  lastOrigin: EditOrigin | null;

  // --- écritures (chacune réconcilie vers l'AST source de vérité) ---
  /** Équipe B (éditeur) & Émie (langage naturel) : nouveau code -> parse -> ast -> graph. */
  setSource: (source: string, origin: EditOrigin) => void;
  /** Équipe A (blocs) : édition du graphe -> graphToAst -> ast -> code. */
  applyGraphEdit: (graph: GraphModel, origin: EditOrigin) => void;
  /** Suppression d'un node : retire le statement de l'objet, re-dérive tout. */
  deleteNode: (nodeId: string) => void;
  /**
   * Création d'un node : insère le statement de `node` (construit via
   * `blocks/node-create.ts`) dans l'objet selon `target` (arête/port/libre),
   * puis re-dérive graph/AST/code.
   */
  insertNode: (target: InsertTarget, node: GraphNode) => void;
  /**
   * Modification d'un node : remplace le statement au chemin `nodeId` par celui
   * de `node` (reconstruit depuis le formulaire), puis re-dérive.
   */
  updateNode: (nodeId: string, node: GraphNode) => void;
  /** Change le langage de parsing (re-parse le code courant). */
  setLanguage: (language: SupportedLanguage) => void;
  /** Réinitialise tout l'état. */
  reset: () => void;

  // --- expansion des définitions de fonction ---
  /** Ensemble des IDs de nœuds de fonction dont le corps est actuellement déplié. */
  expandedFunctions: Set<string>;
  /** Bascule l'état déplié/replié d'un nœud de définition de fonction. */
  toggleFunctionNode: (nodeId: string) => void;
}
