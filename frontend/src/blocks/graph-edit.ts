/**
 * graph-edit — éditions du `GraphModel` côté blocs, AVANT tout round-trip AST.
 *
 * Phase 1 (visuel) : la suppression agit uniquement sur la projection `graph`.
 * Elle ne touche pas à l'AST (les transforms `graphToAst`/`generate` sont encore
 * des stubs — voir ../sync/transforms.ts). Fonctions pures et testables.
 */

import type { CreatedSubgraph, GraphEdge, GraphModel, GraphNode, InsertOp, InsertPort } from "../shared";
import type { TypedGraphNode } from "./typed-nodes";
import type { Statement } from "./types/globalType";
import { declaredNames, referencedNames } from "./var-refs";

/**
 * Une arête est « de flux » (continuation de la spine) si elle arrive sur la
 * poignée d'entrée d'exécution `exec-in`. Cela couvre `exec`, `branch-true`,
 * `branch-false`, `loop-back`, `function-body` et `calls` qui se branchent dans
 * la colonne d'exécution. Les arêtes d'expression arrivent sur `value-out` et
 * ne sont donc jamais considérées comme du flux.
 */
function isFlowEdge(edge: GraphEdge): boolean {
  return edge.targetHandle === "exec-in";
}

/**
 * Supprime un node et, en cascade, tout son contenu (descendants par préfixe de
 * chemin), puis rebranche la spine pour ne pas laisser de liens pendants.
 *
 * Cascade : les ids sont path-based (`s/0`, `s/0/then/1`, `s/0/cond`…), donc un
 * node est « contenu » dans la cible ssi son id est la cible ou commence par
 * `cibleId + "/"`. Une seule règle couvre les blocs (corps if/boucle) ET les
 * variables (sous-arbre d'expression latéral).
 *
 * Rebranchement : pour chaque prédécesseur externe `p` (arête de flux entrant
 * dans l'ensemble supprimé) et chaque successeur externe `n` (arête de flux
 * sortant vers l'extérieur), on ajoute un pont `p → n`. Le pont conserve le kind
 * du prédécesseur s'il vient d'un port `branch-false` (dangling-else), sinon il
 * devient un `exec` standard.
 */
export function deleteNodeFromGraph(
  graph: GraphModel,
  nodeId: string,
): GraphModel {
  const prefix = `${nodeId}/`;
  const isDeleted = (id: string): boolean =>
    id === nodeId || id.startsWith(prefix);

  // L'ensemble supprimé existe-t-il vraiment ? (no-op défensif)
  if (!graph.nodes.some((n) => n.id === nodeId)) return graph;

  // Prédécesseurs externes (flux entrant dans D) et successeurs externes
  // (flux sortant de D vers l'extérieur).
  const entries: GraphEdge[] = [];
  const successors = new Set<string>();
  for (const edge of graph.edges) {
    if (!isFlowEdge(edge)) continue;
    const srcIn = isDeleted(edge.source);
    const tgtIn = isDeleted(edge.target);
    if (!srcIn && tgtIn) entries.push(edge); // p → x∈D
    else if (srcIn && !tgtIn) successors.add(edge.target); // x∈D → n
  }

  const nodes = graph.nodes.filter((n) => !isDeleted(n.id));
  const edges = graph.edges.filter(
    (e) => !isDeleted(e.source) && !isDeleted(e.target),
  );

  // Ponts : produit cartésien (prédécesseur × successeur). On déduplique contre
  // les arêtes SURVIVANTES (clé source→target:kind) pour ne jamais recréer une
  // connexion déjà présente — sinon des suppressions successives génèrent des
  // ids de pont en double (clés React non uniques).
  const existing = new Set(
    edges.map((e) => `${e.source}->${e.target}:${e.kind}`),
  );
  for (const entry of entries) {
    const isFalse = entry.kind === "branch-false";
    const kind: GraphEdge["kind"] = isFalse ? "branch-false" : "exec";
    const sourceHandle = isFalse ? "branch-false" : "exec-out";
    for (const target of successors) {
      if (entry.source === target) continue; // pas de boucle sur soi-même
      const key = `${entry.source}->${target}:${kind}`;
      if (existing.has(key)) continue;
      existing.add(key);
      edges.push({
        // id déterministe : stable et unique pour une connexion donnée.
        id: `bridge-${entry.source}->${target}-${kind}`,
        source: entry.source,
        target,
        kind,
        sourceHandle,
        targetHandle: "exec-in",
      });
    }
  }

  return { nodes, edges };
}

/**
 * Insère `newNode` SUR une arête de flux existante, en la scindant en deux :
 * `source → newNode` (conserve le kind/handle/label de l'arête d'origine, ex.
 * une branche `branch-true`) puis `newNode → target` (continuation `exec`).
 *
 * Le node créé devient donc le nouveau maillon à cet endroit de la spine. Si
 * l'arête n'existe pas (ou si le node existe déjà), no-op défensif.
 */
export function insertNodeOnEdge(
  graph: GraphModel,
  edgeId: string,
  created: CreatedSubgraph,
): GraphModel {
  const edge = graph.edges.find((e) => e.id === edgeId);
  if (!edge) return graph;
  const entry = created.node;
  if (graph.nodes.some((n) => n.id === entry.id)) return graph;

  const nodes = [...graph.nodes, entry, ...created.nodes];

  // Arête entrante : on hérite du kind/handle d'origine pour rester cohérent
  // (insérer sur une branche `true` garde la branche jusqu'au nouveau node).
  const incoming: GraphEdge = {
    id: `ins-${entry.id}-in`,
    source: edge.source,
    target: entry.id,
    kind: edge.kind,
    ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
    ...(edge.label ? { label: edge.label } : {}),
    targetHandle: "exec-in",
  };
  // Arête sortante : continuation d'exécution standard vers l'ancienne cible.
  const outgoing: GraphEdge = {
    id: `ins-${entry.id}-out`,
    source: entry.id,
    target: edge.target,
    kind: "exec",
    sourceHandle: "exec-out",
    targetHandle: "exec-in",
  };

  const edges = graph.edges.filter((e) => e.id !== edgeId);
  edges.push(incoming, outgoing, ...created.edges);
  return { nodes, edges };
}

/**
 * Accroche `newNode` à un PORT ouvert de `nodeId` (fin de spine, branche/corps
 * vide). Crée l'arête correspondant au port ; pour un corps de boucle (`body`),
 * ajoute aussi l'arête `loop-back` du nouveau node vers la boucle (cohérent avec
 * `connectLoopBlock` d'object-to-graph). No-op défensif si le node est absent ou
 * si le node créé existe déjà.
 */
export function insertNodeAtPort(
  graph: GraphModel,
  nodeId: string,
  port: InsertPort,
  created: CreatedSubgraph,
): GraphModel {
  if (!graph.nodes.some((n) => n.id === nodeId)) return graph;
  const entry = created.node;
  if (graph.nodes.some((n) => n.id === entry.id)) return graph;

  const id = `ins-${entry.id}-port`;
  const newEdges: GraphEdge[] = [];

  switch (port) {
    case "exec-out":
      newEdges.push({ id, source: nodeId, target: entry.id, kind: "exec", sourceHandle: "exec-out", targetHandle: "exec-in" });
      break;
    case "true":
      newEdges.push({ id, source: nodeId, target: entry.id, kind: "branch-true", sourceHandle: "branch-true", targetHandle: "exec-in", label: "true" });
      break;
    case "false":
      newEdges.push({ id, source: nodeId, target: entry.id, kind: "branch-false", sourceHandle: "branch-false", targetHandle: "exec-in", label: "false" });
      break;
    case "body":
      newEdges.push({ id, source: nodeId, target: entry.id, kind: "branch-true", sourceHandle: "branch-true", targetHandle: "exec-in", label: "body" });
      newEdges.push({ id: `ins-${entry.id}-loopback`, source: entry.id, target: nodeId, kind: "loop-back", sourceHandle: "exec-out", targetHandle: "exec-in", label: "↩" });
      break;
  }

  return {
    nodes: [...graph.nodes, entry, ...created.nodes],
    edges: [...graph.edges, ...newEdges, ...created.edges],
  };
}

/**
 * Calcule l'ensemble des ids à supprimer quand on supprime `nodeId`.
 *
 * - Si le node n'est pas une déclaration de variable → `[nodeId]` (suppression
 *   simple, comportement inchangé).
 * - Sinon → « slice » transitif global : la variable, tout node de la spine qui
 *   référence un de ses noms, puis (transitivité) les noms déclarés par ces
 *   nodes, jusqu'au point fixe. La recherche est globale (par nom, sans scope).
 *
 * On ne retourne que des ids de spine ; leurs sous-arbres (expressions, corps de
 * bloc) suivent via le cascade par préfixe de `deleteNodeFromGraph`.
 */
export function collectVariableDeletionIds(
  graph: GraphModel,
  nodeId: string,
): string[] {
  const nodes = graph.nodes as TypedGraphNode[];
  const target = nodes.find((n) => n.id === nodeId);
  const targetStmt = target?.stmt as Statement | undefined;
  if (!targetStmt || targetStmt.kind !== "variable-declaration") return [nodeId];

  const deadNames = new Set(declaredNames(targetStmt));
  const toDelete = new Set<string>([nodeId]);

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.track !== "spine" || toDelete.has(node.id)) continue;
      const stmt = node.stmt as Statement;
      if (!referencedNames(stmt).some((r) => deadNames.has(r))) continue;
      toDelete.add(node.id);
      changed = true;
      // Transitivité : ce node déclare-t-il de nouveaux noms désormais morts ?
      for (const n of declaredNames(stmt)) deadNames.add(n);
    }
  }

  return [...toDelete];
}

/**
 * Ré-applique une série de suppressions (par id) sur un graphe fraîchement
 * dérivé de l'AST. Sert à rendre les suppressions « collantes » à travers les
 * re-dérivations (collapse/expand d'une fonction) tant que le round-trip AST
 * n'existe pas. Un id absent du graphe est ignoré (no-op).
 */
export function applyDeletions(
  graph: GraphModel,
  deletedIds: Iterable<string>,
): GraphModel {
  let result = graph;
  for (const id of deletedIds) result = deleteNodeFromGraph(result, id);
  return result;
}

/**
 * Ré-applique une série de créations (insertions) sur un graphe fraîchement
 * dérivé de l'AST. Pendant de `applyDeletions` pour la création : rend les nodes
 * créés « collants » à travers les re-dérivations (collapse/expand) tant que le
 * round-trip AST n'existe pas. Une cible introuvable est ignorée (no-op).
 */
export function applyInsertions(
  graph: GraphModel,
  ops: Iterable<InsertOp>,
): GraphModel {
  let result = graph;
  for (const op of ops) {
    if (op.target.kind === "edge") {
      result = insertNodeOnEdge(result, op.target.edgeId, op.created);
    } else if (op.target.kind === "port") {
      result = insertNodeAtPort(result, op.target.nodeId, op.target.port, op.created);
    }
  }
  return result;
}

/**
 * Ré-applique les éditions de nodes (modification visuelle). Remplace chaque node
 * dont l'id est dans `edits` par sa version éditée — appliqué EN DERNIER, après
 * suppressions et insertions, donc couvre uniformément les nodes dérivés de l'AST
 * comme ceux créés à la main. Arêtes inchangées (l'édition ne touche que le node).
 */
export function applyEdits(
  graph: GraphModel,
  edits: Map<string, GraphNode>,
): GraphModel {
  if (edits.size === 0) return graph;
  return {
    nodes: graph.nodes.map((n) => edits.get(n.id) ?? n),
    edges: graph.edges,
  };
}
