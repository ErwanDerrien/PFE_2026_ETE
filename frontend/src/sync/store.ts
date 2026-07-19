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
 * Édition de blocs DIFFÉRÉE : re-dérive uniquement le `graph` (la vue blocs voit
 * son édition) sans régénérer `ast`/`source` — la propagation aux autres vues
 * n'a lieu qu'au clic sur le bouton global (`sync()`). Marque `dirty`.
 */
function projectLocal(codeObj: FunctionDeclaration, expandedFunctions: Set<string>) {
  const graph = objectToGraph(codeObj, { expandedFunctions });
  return { codeObj, graph, dirty: true, error: null, lastOrigin: 'blocks' as EditOrigin };
}

/** Extrait le `stmt` structuré d'un node construit par `node-create`. */
const stmtOf = (node: GraphNode): Statement => (node as unknown as TypedGraphNode).stmt as Statement;

/** Libellés des vues pour le message de confirmation du garde-fou. */
const VIEW_LABEL: Record<string, string> = {
  editor: "de l'éditeur de code",
  blocks: "des blocs visuels",
  'natural-lang': 'du langage naturel',
};

/**
 * Garde-fou cross-vues : éditer une vue alors qu'une AUTRE vue a des
 * modifications non synchronisées écraserait silencieusement ce tampon
 * (politique « dernière origine gagne »). On demande confirmation explicite.
 */
function confirmDiscard(lastOrigin: EditOrigin): boolean {
  return window.confirm(
    `Des modifications ${VIEW_LABEL[lastOrigin] ?? 'd’une autre vue'} n'ont pas été synchronisées.\n` +
    `Continuer les ignorera définitivement.\n\nContinuer quand même ?`,
  );
}

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
  dirty: false,
  pendingSource: null,

  // --- écritures ---
  setSource: (source, origin) => {
    const { language, ast: currentAst } = get();

    // Sync DIFFÉRÉE : une frappe dans l'éditeur (ou une écriture du langage
    // naturel) reste dans le tampon `pendingSource` jusqu'au bouton global.
    // Exceptions propagées immédiatement : le tout premier chargement
    // (ast === null : les autres vues doivent s'amorcer) et `system` (setLanguage).
    if (currentAst !== null && origin !== 'system') {
      // Garde-fou : une AUTRE vue a du travail non synchronisé → confirmation.
      const { dirty, lastOrigin } = get();
      if (dirty && lastOrigin && lastOrigin !== origin) {
        if (!confirmDiscard(lastOrigin)) return; // édition refusée, tampon préservé
        if (lastOrigin === 'blocks') {
          // Écarte le tampon des blocs : re-projette codeObj/graph depuis l'AST synchronisé.
          const revertObj = traversePath(currentAst) as FunctionDeclaration;
          set({
            codeObj: revertObj,
            graph: objectToGraph(revertObj, { expandedFunctions: new Set() }),
            expandedFunctions: new Set(),
          });
        }
        // (tampon editor/natural-lang : simplement remplacé par le nouveau ci-dessous)
      }
      set({ pendingSource: source, dirty: true, lastOrigin: origin });
      return;
    }

    try {
      const ast = parse(source, language);
      try {
        // L'objet structuré devient la base éditable des blocs.
        const codeObj = traversePath(ast) as FunctionDeclaration;
        const graph = objectToGraph(codeObj, { expandedFunctions: new Set() });
        set({ ast, codeObj, source, graph, expandedFunctions: new Set(), dirty: false, pendingSource: null, error: null, lastOrigin: origin });
      } catch (e) {
        set({ ast, source, expandedFunctions: new Set(), error: toSyncError('astToGraph', e), lastOrigin: origin });
      }
    } catch (e) {
      set({ source, error: toSyncError('parse', e), lastOrigin: origin });
    }
  },

  /**
   * Bouton global : propage la vue émettrice (lastOrigin) vers les autres.
   * Politique simple « dernière origine gagne » : si deux vues ont été éditées
   * sans synchroniser, c'est la plus récente (lastOrigin) qui est propagée.
   */
  sync: () => {
    const { dirty, lastOrigin, pendingSource, codeObj, language } = get();
    if (!dirty) return;

    if (lastOrigin === 'blocks') {
      // blocs → AST → code. L'éditeur (contrôlé quand lastOrigin ≠ editor) se met à jour.
      if (!codeObj) return;
      try {
        const ast = convertObjectToAst(codeObj as FunctionDeclaration);
        const source = generate(ast);
        set({ ast, source, dirty: false, pendingSource: null, error: null });
      } catch (e) {
        set({ error: toSyncError('graphToAst', e) });
      }
      return;
    }

    // editor / natural-lang → parse → objet → graph. Les blocs se re-projettent ;
    // l'éditeur garde son texte (non contrôlé quand lastOrigin === 'editor').
    const src = pendingSource ?? get().source;
    try {
      const ast = parse(src, language);
      const nextObj = traversePath(ast) as FunctionDeclaration;
      const graph = objectToGraph(nextObj, { expandedFunctions: new Set() });
      set({ ast, codeObj: nextObj, source: src, graph, expandedFunctions: new Set(), dirty: false, pendingSource: null, error: null });
    } catch (e) {
      // Code invalide : on garde le tampon (dirty reste vrai) et on remonte l'erreur.
      set({ error: toSyncError('parse', e) });
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
      dirty: false,
      pendingSource: null,
    }),

  // --- éditions de blocs : mutent l'objet structuré, puis re-dérivent ---
  // Garde-fou commun : si une AUTRE vue (éditeur/langage naturel) a un tampon
  // non synchronisé, confirmation avant de l'écarter. En cas d'accord, on jette
  // simplement `pendingSource` — le codeObj/graph affiché EST le dernier état
  // synchronisé, donc les cibles de l'édition restent valides.
  insertNode: (target, node) => {
    const { codeObj, graph, expandedFunctions, dirty, lastOrigin } = get();
    if (!codeObj) return;
    if (dirty && lastOrigin && lastOrigin !== 'blocks') {
      if (!confirmDiscard(lastOrigin)) return;
      set({ pendingSource: null, dirty: false });
    }
    const next = objectInsert(codeObj as FunctionDeclaration, graph, target, stmtOf(node));
    if (!next) return;
    set(projectLocal(next, expandedFunctions));
  },

  updateNode: (nodeId, node) => {
    const { codeObj, expandedFunctions, dirty, lastOrigin } = get();
    if (!codeObj) return;
    if (dirty && lastOrigin && lastOrigin !== 'blocks') {
      if (!confirmDiscard(lastOrigin)) return;
      set({ pendingSource: null, dirty: false });
    }
    const next = objectUpdate(codeObj as FunctionDeclaration, nodeId, stmtOf(node));
    if (!next) return;
    set(projectLocal(next, expandedFunctions));
  },

  deleteNode: (nodeId) => {
    const { codeObj, expandedFunctions, dirty, lastOrigin } = get();
    if (!codeObj) return;
    if (dirty && lastOrigin && lastOrigin !== 'blocks') {
      if (!confirmDiscard(lastOrigin)) return;
      set({ pendingSource: null, dirty: false });
    }
    const next = objectDelete(codeObj as FunctionDeclaration, nodeId);
    if (!next) return;
    set(projectLocal(next, expandedFunctions));
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
