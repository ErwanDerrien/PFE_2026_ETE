/**
 * GraphModel — le modèle de graphe *agnostique au framework* qui décrit la
 * représentation visuelle (blocs). C'est une PROJECTION de l'AST Babel, qui
 * reste la source de vérité (voir `engine.ts`).
 *
 * Volontairement sans dépendance à React Flow : l'équipe A (/blocks) mappe ces
 * types vers les `Node`/`Edge` de React Flow au moment du rendu. Ainsi /shared
 * ne dépend d'aucune librairie d'UI.
 *
 * Propriétaire des règles de transformation : équipe A (/sync, /blocks).
 */

/** Position d'un nœud dans le code source (lignes/colonnes Babel, 1-based pour la ligne). */
export interface SourceLoc {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Rôle sémantique d'un nœud — encode la *couleur* (« color by role, not type »).
 * - boundary   : frontière de fonction/bloc (violet)
 * - statement  : instruction simple (sarcelle)
 * - control    : flux de contrôle if/for/while/switch (ambre)
 * - expression : expression évaluant une valeur (corail)
 * - literal    : littéraux et identifiants (gris)
 */
export type NodeRole =
  | 'boundary'
  | 'statement'
  | 'control'
  | 'expression'
  | 'literal';

/**
 * Voie (« track ») du nœud dans la mise en page :
 * - spine      : la colonne d'exécution principale (flèches blanches).
 * - expression : les sous-arbres d'expression qui pendent sur le côté.
 */
export type NodeTrack = 'spine' | 'expression';

/**
 * Niveau de détail (système à 3 niveaux du design Bolt) :
 * 1 = phases (résumé), 2 = statements, 3 = sous-arbre d'expression.
 * Le rendu n'affiche le niveau N+1 que lorsqu'on déplie un nœud du niveau N.
 */
export type NodeLevel = 1 | 2 | 3;

/**
 * Type d'arête :
 * - exec         : « l'exécution continue ici » entre deux nœuds spine (flèche épaisse).
 * - expression   : « ce nœud évalue ce sous-arbre » (flèche fine, en pointillés).
 * - branch-true  : branche vraie d'un if/switch/ternaire.
 * - branch-false : branche fausse.
 * - calls        : « appelle dans » — drill-in vers le corps d'une fonction (Niveau 3).
 */
export type EdgeKind =
  | 'exec'
  | 'expression'
  | 'branch-true'
  | 'branch-false'
  | 'calls'
  | 'function-body' // expanded function definition → first body statement
  | 'loop-back'; // end of loop body → loop node (back edge showing iteration)

/**
 * Poignées typées (« typed handles ») pour l'édition par blocs : ne permettre que
 * des connexions valides afin que le graphe corresponde toujours à un AST valide.
 * Utilisées par l'équipe A pour configurer les handles React Flow + `graphToAst`.
 */
export type HandleKind =
  | 'exec-in'
  | 'exec-out'
  | 'args'
  | 'value-out'
  | 'branch-true'
  | 'branch-false';

/** Un nœud visuel — projection d'un nœud de l'AST. */
export interface GraphNode {
  /** Identifiant stable (dérivé du chemin AST quand c'est possible, pour la stabilité du diff). */
  id: string;
  role: NodeRole;
  track: NodeTrack;
  level: NodeLevel;
  /** Libellé lisible par un humain, ex. « method call », « if branch », « variable ». */
  label: string;
  /** Texte source brut (sert aux pastilles repliées). */
  source?: string;
  /** True si le sous-arbre est replié en une pastille. */
  collapsed?: boolean;
  /** Inline member rows (used by interface nodes to show properties directly). */
  members?: string[];
  /** Type du nœud Babel d'origine (debug + aide au round-trip), ex. « IfStatement ». */
  astType: string;
  /** Pointeur de retour vers l'emplacement dans l'AST (pour `graphToAst`). */
  astPath?: string;
  loc?: SourceLoc;
  /** Point d'extension libre pour l'équipe A (données spécifiques au rendu). */
  data?: Record<string, unknown>;
}

/** Une arête entre deux nœuds visuels. */
export interface GraphEdge {
  id: string;
  /** id du nœud source. */
  source: string;
  /** id du nœud cible. */
  target: string;
  kind: EdgeKind;
  /** Libellé optionnel, ex. « true » / « false » sur les branches. */
  label?: string;
  /** Poignée source (pour l'édition contrainte). */
  sourceHandle?: HandleKind;
  /** Poignée cible (pour l'édition contrainte). */
  targetHandle?: HandleKind;
}

/** Le graphe complet rendu par React Flow (nodes + edges). */
export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Un graphe vide — point de départ pratique. */
export const EMPTY_GRAPH: GraphModel = { nodes: [], edges: [] };

/**
 * Port « ouvert » d'un node sur lequel on peut accrocher un nouveau node :
 * - exec-out : continuation après le node (fin de spine).
 * - true / false : branche vraie/fausse vide d'un `if`.
 * - body : corps vide d'une boucle (ajoute aussi l'arête `loop-back`).
 */
export type InsertPort = "exec-out" | "true" | "false" | "body";

/**
 * Cible d'une insertion de node (création de blocs, phase visuelle).
 * - `edge` : scinder une arête de flux existante (le `+` au survol d'une arête).
 * - `port` : accrocher à un port ouvert d'un node (fin de spine, branche/corps vide).
 * - `floating` : node « libre », non relié au flow (ex. une fonction à côté).
 */
export type InsertTarget =
  | { kind: "edge"; edgeId: string }
  | { kind: "port"; nodeId: string; port: InsertPort }
  | { kind: "floating" };

/**
 * Sous-graphe créé pour un nouveau bloc. La plupart des blocs = un seul `node`
 * (nodes/edges vides). Les blocs à sous-structure (ex. switch : un node par
 * `case`) fournissent en plus `nodes`/`edges` internes. `node` est l'entrée
 * raccordée à la spine.
 */
export interface CreatedSubgraph {
  node: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Une insertion persistée : le sous-graphe construit + sa cible. Mémorisée par le
 * store pour ré-appliquer la création après chaque re-dérivation du graphe
 * (collapse/expand), tant que le round-trip AST n'existe pas — miroir de la
 * liste des suppressions.
 */
export interface InsertOp {
  target: InsertTarget;
  created: CreatedSubgraph;
}
