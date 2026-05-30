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
import type { GraphModel, SourceLoc } from './graph';

/** Options de transformation AST -> graphe (réglages de l'équipe A). */
export interface GraphOptions {
  /** Replier les sous-arbres d'expression courts en pastilles (« j*j »). */
  collapseExpressions?: boolean;
  /** Longueur max. du texte source pour replier en pastille (défaut ~15). */
  collapseMaxLength?: number;
  /** Regrouper les statements en phases via les lignes vides (Niveau 1). */
  groupByBlankLines?: boolean;
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

  // --- projections dérivées (maintenues à jour depuis `ast`) ---
  /** Le code source courant (dérivé via generate, ou tel que saisi). */
  source: string;
  /** Le graphe de blocs courant (dérivé via astToGraph). */
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
  /** Change le langage de parsing (re-parse le code courant). */
  setLanguage: (language: SupportedLanguage) => void;
  /** Réinitialise tout l'état. */
  reset: () => void;
}
