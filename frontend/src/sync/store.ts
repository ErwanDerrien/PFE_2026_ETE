/**
 * Store AST partagé — la SOURCE UNIQUE DE VÉRITÉ de toute l'application.
 *
 * L'état canonique est `ast` (l'AST Babel). `source` (code) et `graph` (blocs)
 * sont des projections maintenues à jour à chaque écriture. Toutes les équipes
 * LISENT cet état via `useAstStore(...)` ; elles ÉCRIVENT uniquement via les
 * actions, qui réconcilient systématiquement vers l'AST.
 *
 * Flux d'écriture :
 *   - éditeur (B) / langage naturel (Émie) : `setSource(code, origin)`
 *       -> parse -> ast -> astToGraph -> graph
 *   - blocs (A) : `applyGraphEdit(graph, origin)`
 *       -> graphToAst -> ast -> generate -> code
 *
 * `lastOrigin` permet à chaque vue d'ignorer ses propres modifications et d'éviter
 * les boucles de synchronisation.
 *
 * Propriétaire : équipe A (/sync). Branché sur des transforms encore en STUB —
 * voir `transforms.ts`. Le câblage est complet ; il « marchera » dès que l'équipe A
 * implémentera les quatre transformations.
 */

import { create } from 'zustand';
import type { AstStoreState, SyncError, SyncPhase } from '../shared';
import { DEFAULT_LANGUAGE, EMPTY_GRAPH } from '../shared';
import { astToGraph, generate, graphToAst, parse } from './transforms';
import { applyDeletions, deleteNodeFromGraph } from '../blocks/graph-edit';

/** Normalise n'importe quelle exception en `SyncError` taggée par phase. */
function toSyncError(phase: SyncPhase, e: unknown): SyncError {
  return { phase, message: e instanceof Error ? e.message : String(e) };
}

export const useAstStore = create<AstStoreState>()((set, get) => ({
  // --- état initial ---
  ast: null,
  source: '',
  graph: EMPTY_GRAPH,
  language: DEFAULT_LANGUAGE,
  error: null,
  lastOrigin: null,
  expandedFunctions: new Set<string>(),
  deletedNodes: new Set<string>(),

  // --- écritures ---
  setSource: (source, origin) => {
    const { language } = get();
    try {
      const ast = parse(source, language);
      try {
        // Reset expansion AND deletion state when source changes — node IDs are
        // path-based and may shift, so persisted deletions no longer apply.
        const graph = astToGraph(ast);
        set({ ast, source, graph, expandedFunctions: new Set(), deletedNodes: new Set(), error: null, lastOrigin: origin });
      } catch (e) {
        set({ ast, source, expandedFunctions: new Set(), deletedNodes: new Set(), error: toSyncError('astToGraph', e), lastOrigin: origin });
      }
    } catch (e) {
      set({ source, error: toSyncError('parse', e), lastOrigin: origin });
    }
  },

  applyGraphEdit: (graph, origin) => {
    const { ast } = get();
    if (!ast) {
      set({
        graph,
        lastOrigin: origin,
        error: {
          phase: 'graphToAst',
          message: 'Aucun AST de base : parsez du code avant d’éditer les blocs.',
        },
      });
      return;
    }
    try {
      const nextAst = graphToAst(graph, ast);
      try {
        const source = generate(nextAst);
        set({ ast: nextAst, graph, source, error: null, lastOrigin: origin });
      } catch (e) {
        set({ ast: nextAst, graph, error: toSyncError('generate', e), lastOrigin: origin });
      }
    } catch (e) {
      set({ graph, error: toSyncError('graphToAst', e), lastOrigin: origin });
    }
  },

  setLanguage: (language) => {
    set({ language });
    // Re-parse le code courant avec le nouveau langage.
    get().setSource(get().source, 'system');
  },

  reset: () =>
    set({
      ast: null,
      source: '',
      graph: EMPTY_GRAPH,
      error: null,
      lastOrigin: null,
      expandedFunctions: new Set(),
      deletedNodes: new Set(),
    }),

  deleteNode: (nodeId: string) => {
    // Phase 1 : suppression purement visuelle. On mute directement le `graph`
    // (que le canvas lit) sans passer par graphToAst/generate (encore en stub).
    // On mémorise l'id pour ré-appliquer la suppression après un collapse/expand.
    const { graph, deletedNodes } = get();
    const nextDeleted = new Set(deletedNodes).add(nodeId);
    set({ graph: deleteNodeFromGraph(graph, nodeId), deletedNodes: nextDeleted, lastOrigin: 'blocks' });
  },

  toggleFunctionNode: (nodeId: string) => {
    const { ast, expandedFunctions, deletedNodes } = get();
    if (!ast) return;
    const next = new Set(expandedFunctions);
    if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
    try {
      // Re-dérive depuis l'AST PUIS ré-applique les suppressions persistées.
      const graph = applyDeletions(astToGraph(ast, { expandedFunctions: next }), deletedNodes);
      set({ expandedFunctions: next, graph });
    } catch (e) {
      set({ expandedFunctions: next, error: toSyncError('astToGraph', e) });
    }
  },
}));
