/**
 * Store AST partagé — SOURCE UNIQUE DE VÉRITÉ de l'application.
 *
 * Deux états canoniques :
 *   - `ast`     : l'AST Babel (pour l'éditeur de code, le langage naturel).
 *   - `codeObj` : l'OBJET STRUCTURÉ (`<global>` FunctionDeclaration) — source de
 *                 vérité des BLOCS. Les éditions de blocs le mutent.
 * `source` et `graph` sont des projections re-dérivées à chaque écriture.
 *
 * Flux :
 *   - éditeur (B) / langage naturel : `setSource(code)` → parse → ast → codeObj
 *     (traversePath) → graph (objectToGraph).
 *   - blocs (A) : `insertNode/updateNode/deleteNode` → mutent `codeObj` →
 *     graph (objectToGraph) + ast (convertObjectToAst) + source (generate).
 *
 * Propriétaire : équipe A (/sync).
 */

import { create } from 'zustand';
import type { AstStoreState, EditOrigin, GraphNode, SyncError, SyncPhase } from '../shared';
import { DEFAULT_LANGUAGE, EMPTY_GRAPH } from '../shared';
import { generate, parse } from './transforms';
import traversePath from '../blocks/ast-mapping';
import { objectToGraph } from '../blocks/object-to-graph';
import { convertObjectToAst } from '../blocks/astConverter/ast-converter';
import { objectDelete, objectInsert, objectUpdate } from '../blocks/object-edit';
import type { FunctionDeclaration } from '../blocks/types/function';
import type { Statement } from '../blocks/types/globalType';
import type { TypedGraphNode } from '../blocks/typed-nodes';

/** Normalise n'importe quelle exception en `SyncError` taggée par phase. */
function toSyncError(phase: SyncPhase, e: unknown): SyncError {
  return { phase, message: e instanceof Error ? e.message : String(e) };
}

/**
 * Re-dérive le `graph` (toujours) puis l'`ast`/`source` (best-effort) depuis un
 * objet structuré édité. Renvoie un patch d'état pour `set`.
 */
function project(codeObj: FunctionDeclaration, expandedFunctions: Set<string>) {
  const graph = objectToGraph(codeObj, { expandedFunctions });
  try {
    const ast = convertObjectToAst(codeObj);
    const source = generate(ast);
    return { codeObj, graph, ast, source, error: null, lastOrigin: 'blocks' as EditOrigin };
  } catch (e) {
    return { codeObj, graph, error: toSyncError('graphToAst', e), lastOrigin: 'blocks' as EditOrigin };
  }
}

/** Extrait le `stmt` structuré d'un node construit par `node-create`. */
const stmtOf = (node: GraphNode): Statement => (node as unknown as TypedGraphNode).stmt as Statement;

export const useAstStore = create<AstStoreState>()((set, get) => ({
  // --- état initial ---
  ast: null,
  codeObj: null,
  source: '',
  graph: EMPTY_GRAPH,
  language: DEFAULT_LANGUAGE,
  error: null,
  lastOrigin: null,
  expandedFunctions: new Set<string>(),

  // --- écritures ---
  setSource: (source, origin) => {
    const { language } = get();
    try {
      const ast = parse(source, language);
      try {
        // L'objet structuré devient la base éditable des blocs.
        const codeObj = traversePath(ast) as FunctionDeclaration;
        const graph = objectToGraph(codeObj, { expandedFunctions: new Set() });
        set({ ast, codeObj, source, graph, expandedFunctions: new Set(), error: null, lastOrigin: origin });
      } catch (e) {
        set({ ast, source, expandedFunctions: new Set(), error: toSyncError('astToGraph', e), lastOrigin: origin });
      }
    } catch (e) {
      set({ source, error: toSyncError('parse', e), lastOrigin: origin });
    }
  },

  // Conservé pour le contrat : mise à jour visuelle du graphe sans round-trip.
  applyGraphEdit: (graph, origin) => set({ graph, lastOrigin: origin }),

  setLanguage: (language) => {
    set({ language });
    get().setSource(get().source, 'system');
  },

  reset: () =>
    set({
      ast: null,
      codeObj: null,
      source: '',
      graph: EMPTY_GRAPH,
      error: null,
      lastOrigin: null,
      expandedFunctions: new Set(),
    }),

  // --- éditions de blocs : mutent l'objet structuré, puis re-dérivent ---
  insertNode: (target, node) => {
    const { codeObj, graph, expandedFunctions } = get();
    if (!codeObj) return;
    const next = objectInsert(codeObj as FunctionDeclaration, graph, target, stmtOf(node));
    if (!next) return;
    set(project(next, expandedFunctions));
  },

  updateNode: (nodeId, node) => {
    const { codeObj, expandedFunctions } = get();
    if (!codeObj) return;
    const next = objectUpdate(codeObj as FunctionDeclaration, nodeId, stmtOf(node));
    if (!next) return;
    set(project(next, expandedFunctions));
  },

  deleteNode: (nodeId) => {
    const { codeObj, expandedFunctions } = get();
    if (!codeObj) return;
    const next = objectDelete(codeObj as FunctionDeclaration, nodeId);
    if (!next) return;
    set(project(next, expandedFunctions));
  },

  toggleFunctionNode: (nodeId) => {
    // Vue seule : déplie/replie une fonction (n'altère pas l'objet ni le code).
    const { codeObj, expandedFunctions } = get();
    if (!codeObj) return;
    const next = new Set(expandedFunctions);
    if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
    set({ expandedFunctions: next, graph: objectToGraph(codeObj as FunctionDeclaration, { expandedFunctions: next }) });
  },
}));
