/**
 * graphToFlow — adapte un `GraphModel` (projection agnostique, voir
 * ../shared/graph.ts) vers les `Node[]`/`Edge[]` de React Flow.
 *
 * Mise en page : auto-layout dagre (top-down) sur TOUS les nœuds et TOUTES
 * les arêtes. Les arêtes structurelles (exec/calls/branches) ont un poids fort
 * pour garder la colonne d'exécution droite ; les arêtes `expression` un poids
 * faible. Les tailles déclarées à dagre viennent de `nodeSize` → aucun
 * chevauchement.
 *
 * Nœuds custom : `block` (carte) et `expr` (pill) — voir ./nodes/.
 * Arêtes : style par `kind` (exec clair épais, data gris pointillé, branches).
 */

import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { EdgeKind, InsertPort } from "../shared";
import { isLooping } from "./block-meta";
import { nodeSize } from "./node-size";
import { TERMINUS_W, TERMINUS_H } from "./nodes/TerminusNode";
import type { TypedGraphModel, TypedGraphNode } from "./typed-nodes";

export interface FlowModel {
  nodes: Node[];
  edges: Edge[];
}

const EDGE_STYLE: Record<EdgeKind, { stroke: string; width: number; dash?: string }> = {
  exec: { stroke: "#c8c8c8", width: 3 },
  calls: { stroke: "#c084fc", width: 2, dash: "3 4" },
  "function-body": { stroke: "#818cf8", width: 2.5 },
  "branch-true": { stroke: "#2dd4bf", width: 2.5 },
  "branch-false": { stroke: "#9ca3af", width: 2, dash: "5 4" },
  expression: { stroke: "#5a5a5a", width: 1.5, dash: "4 3" },
  "loop-back": { stroke: "#f59e0b", width: 2, dash: "6 4" },
};

function sourceHandleFor(kind: EdgeKind): string | undefined {
  if (kind === "branch-true") return "true";
  if (kind === "branch-false") return "false";
  if (kind === "expression" || kind === "calls" || kind === "function-body") return "data";
  return undefined;
}

const edgeWeight = (kind: EdgeKind): number => (kind === "expression" ? 1 : 3);

/**
 * Ports « ouverts » d'un node spine (sans arête sortante du kind attendu) où l'on
 * peut accrocher un nouveau node. Sert à afficher les boutons « + » de port.
 */
function openSlotsFor(node: TypedGraphNode, outKinds: Set<EdgeKind> | undefined): InsertPort[] {
  if (node.track !== "spine" || node.role === "boundary") return [];
  const has = (k: EdgeKind): boolean => outKinds?.has(k) ?? false;
  const slots: InsertPort[] = [];
  if (isLooping(node.astType)) {
    if (!has("branch-true")) slots.push("body"); // corps de boucle vide
    if (!has("exec")) slots.push("exec-out"); // continuation après la boucle
  } else if (node.astType === "IfStatement") {
    if (!has("branch-true")) slots.push("true"); // then vide
    if (!has("branch-false")) slots.push("false"); // else vide / continuation
  } else {
    if (!has("exec")) slots.push("exec-out"); // fin de spine
  }
  return slots;
}

// Edges that block a node from being an execution entry (function-body excluded:
// the first statement of a function body IS an entry point, just not directly reachable).
const ENTRY_BLOCKING_KINDS = new Set<EdgeKind>(["exec", "branch-true", "branch-false"]);
// Edges that mean "execution continues from this node" — used to find exit nodes.
const EXIT_BLOCKING_KINDS = new Set<EdgeKind>(["exec", "branch-true", "branch-false", "function-body"]);

export function graphToFlow(graph: TypedGraphModel): FlowModel {
  const sizes = new Map(graph.nodes.map((n) => [n.id, nodeSize(n)] as const));

  // Compute entry/exit spine nodes for terminus injection.
  const incomingFlow = new Set<string>();
  const outgoingFlow = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.kind === "loop-back") continue;
    if (ENTRY_BLOCKING_KINDS.has(edge.kind)) incomingFlow.add(edge.target);
    if (EXIT_BLOCKING_KINDS.has(edge.kind)) outgoingFlow.add(edge.source);
  }

  type Terminus = { id: string; peerId: string };
  const startTermini: Terminus[] = [];
  const endTermini: Terminus[] = [];
  for (const node of graph.nodes) {
    if (node.track === "expression") continue;
    if (node.role === "boundary") continue; // function declarations are not execution entry/exit points
    if (!incomingFlow.has(node.id)) startTermini.push({ id: `__start__${node.id}`, peerId: node.id });
    if (!outgoingFlow.has(node.id)) endTermini.push({ id: `__end__${node.id}`, peerId: node.id });
  }

  const layout = new dagre.graphlib.Graph();
  layout.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100, marginx: 48, marginy: 48 });
  layout.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    const s = sizes.get(node.id)!;
    layout.setNode(node.id, { width: s.width, height: s.height });
  }
  for (const t of startTermini) layout.setNode(t.id, { width: TERMINUS_W, height: TERMINUS_H });
  for (const t of endTermini)   layout.setNode(t.id, { width: TERMINUS_W, height: TERMINUS_H });

  for (const edge of graph.edges) {
    const minlen = edge.kind === "loop-back" ? 0 : 1;
    layout.setEdge(edge.source, edge.target, { weight: edgeWeight(edge.kind), minlen });
  }
  for (const t of startTermini) layout.setEdge(t.id, t.peerId, { weight: 3, minlen: 1 });
  for (const t of endTermini)   layout.setEdge(t.peerId, t.id, { weight: 3, minlen: 1 });

  dagre.layout(layout);

  // Kinds d'arêtes sortantes par node (pour déduire les ports ouverts).
  const outKinds = new Map<string, Set<EdgeKind>>();
  for (const edge of graph.edges) {
    let set = outKinds.get(edge.source);
    if (!set) outKinds.set(edge.source, (set = new Set()));
    set.add(edge.kind);
  }

  const nodes: Node[] = graph.nodes.map((node) => {
    const s = sizes.get(node.id)!;
    const p = layout.node(node.id);
    const isBlock = node.track !== "expression";
    return {
      id: node.id,
      type: isBlock ? "block" : "expr",
      position: { x: p.x - s.width / 2, y: p.y - s.height / 2 },
      data: isBlock ? { node, openSlots: openSlotsFor(node, outKinds.get(node.id)) } : { node },
    };
  });

  for (const t of startTermini) {
    const p = layout.node(t.id);
    nodes.push({ id: t.id, type: "terminus", position: { x: p.x - TERMINUS_W / 2, y: p.y - TERMINUS_H / 2 }, data: { kind: "start" }, selectable: false, draggable: false });
  }
  for (const t of endTermini) {
    const p = layout.node(t.id);
    nodes.push({ id: t.id, type: "terminus", position: { x: p.x - TERMINUS_W / 2, y: p.y - TERMINUS_H / 2 }, data: { kind: "end" }, selectable: false, draggable: false });
  }

  const SMOOTHSTEP_KINDS = new Set<EdgeKind>(["exec", "branch-true", "branch-false", "calls", "function-body", "loop-back"]);
  // Arêtes « de flux » où l'on peut insérer un node (bouton + au survol). On
  // exclut `calls`/`loop-back`/`expression` : y insérer n'a pas de sens.
  const INSERTABLE_KINDS = new Set<EdgeKind>(["exec", "branch-true", "branch-false", "function-body"]);

  const edges: Edge[] = graph.edges.map((edge) => {
    const style = EDGE_STYLE[edge.kind];
    const sourceHandle = sourceHandleFor(edge.kind);
    const insertable = INSERTABLE_KINDS.has(edge.kind);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(insertable
        ? { type: "insertable" }
        : SMOOTHSTEP_KINDS.has(edge.kind)
          ? { type: "smoothstep", pathOptions: { borderRadius: 12 } }
          : {}),
      ...(sourceHandle ? { sourceHandle } : {}),
      label: edge.label,
      style: {
        stroke: style.stroke,
        strokeWidth: style.width,
        strokeDasharray: style.dash,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: style.stroke, width: 16, height: 16 },
    };
  });

  for (const t of startTermini) {
    edges.push({
      id: `${t.id}-edge`,
      source: t.id,
      target: t.peerId,
      type: "terminus-start",
      data: { peerId: t.peerId },
      style: { stroke: "#4ade80", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#4ade80", width: 14, height: 14 },
    });
  }
  for (const t of endTermini) {
    edges.push({
      id: `${t.id}-edge`,
      source: t.peerId,
      target: t.id,
      type: "smoothstep",
      style: { stroke: "#f87171", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#f87171", width: 14, height: 14 },
    });
  }

  return { nodes, edges };
}
