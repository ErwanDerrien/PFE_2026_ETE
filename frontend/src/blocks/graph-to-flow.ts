/**
 * graphToFlow — adapte un `GraphModel` (projection agnostique, voir
 * ../shared/graph.ts) vers les `Node[]`/`Edge[]` de React Flow.
 *
 * Mise en page hybride :
 *  - dagre (vertical, top-down) sur le sous-graphe « spine » (exec/calls/branches)
 *    → colonne d'exécution ;
 *  - les nœuds d'expression sont placés à droite de leur parent (arêtes `data`),
 *    empilés par colonne pour limiter les chevauchements.
 *
 * Nœuds custom : `block` (carte) et `expr` (pill) — voir ./nodes/.
 * Arêtes : style par `kind` (exec clair épais, data gris pointillé, branches).
 */

import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { EdgeKind, GraphModel, GraphNode } from "../shared";
import { isBranching } from "./block-meta";

const GAP_X = 56;
const GAP_Y = 16;

export interface FlowModel {
  nodes: Node[];
  edges: Edge[];
}

interface Size {
  width: number;
  height: number;
}

function sizeOf(node: GraphNode): Size {
  if (node.track === "expression") {
    const width = Math.min(220, Math.max(64, node.label.length * 7 + 24));
    return { width, height: 34 };
  }
  if (isBranching(node.astType)) return { width: 240, height: 108 };
  return { width: 240, height: 80 };
}

const EDGE_STYLE: Record<EdgeKind, { stroke: string; width: number; dash?: string }> = {
  exec: { stroke: "#e6edf3", width: 2.5 },
  calls: { stroke: "#c084fc", width: 2, dash: "2 4" },
  "branch-true": { stroke: "#2dd4bf", width: 2 },
  "branch-false": { stroke: "#8b949e", width: 2, dash: "5 4" },
  expression: { stroke: "#6e7681", width: 1.2, dash: "4 3" },
};

function sourceHandleFor(kind: EdgeKind): string | undefined {
  if (kind === "branch-true") return "true";
  if (kind === "branch-false") return "false";
  if (kind === "expression") return "data";
  return undefined; // exec / calls → handle bas par défaut
}

export function graphToFlow(graph: GraphModel): FlowModel {
  const byId = new Map<string, GraphNode>();
  const size = new Map<string, Size>();
  for (const node of graph.nodes) {
    byId.set(node.id, node);
    size.set(node.id, sizeOf(node));
  }

  // 1) dagre sur la spine uniquement.
  const layout = new dagre.graphlib.Graph();
  layout.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 64, marginx: 24, marginy: 24 });
  layout.setDefaultEdgeLabel(() => ({}));

  const spineIds = new Set<string>();
  for (const node of graph.nodes) {
    if (node.track === "spine") {
      spineIds.add(node.id);
      const s = size.get(node.id)!;
      layout.setNode(node.id, { width: s.width, height: s.height });
    }
  }
  for (const edge of graph.edges) {
    if (edge.kind !== "expression" && spineIds.has(edge.source) && spineIds.has(edge.target)) {
      layout.setEdge(edge.source, edge.target);
    }
  }
  dagre.layout(layout);

  // Positions (coin haut-gauche).
  const pos = new Map<string, { x: number; y: number }>();
  for (const id of spineIds) {
    const n = layout.node(id);
    const s = size.get(id)!;
    pos.set(id, { x: n.x - s.width / 2, y: n.y - s.height / 2 });
  }

  // 2) Expressions à droite de leur parent (arêtes `data`), empilées par colonne.
  const dataChildren = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.kind !== "expression") continue;
    const list = dataChildren.get(edge.source) ?? [];
    list.push(edge.target);
    dataChildren.set(edge.source, list);
  }

  const colCursor = new Map<number, number>();
  const placeChildren = (parentId: string) => {
    const parent = pos.get(parentId);
    if (!parent) return;
    const parentSize = size.get(parentId)!;
    for (const childId of dataChildren.get(parentId) ?? []) {
      if (pos.has(childId)) continue; // déjà placé (évite les cycles)
      const childSize = size.get(childId)!;
      const x = parent.x + parentSize.width + GAP_X;
      const col = Math.round(x);
      const y = Math.max(parent.y, colCursor.get(col) ?? parent.y);
      pos.set(childId, { x, y });
      colCursor.set(col, y + childSize.height + GAP_Y);
      placeChildren(childId);
    }
  };
  // Parcourt les nœuds spine de haut en bas pour remplir les colonnes dans l'ordre.
  [...spineIds]
    .sort((a, b) => (pos.get(a)?.y ?? 0) - (pos.get(b)?.y ?? 0))
    .forEach(placeChildren);

  // Filet de sécurité : tout nœud non placé (graphe biscornu) atterrit en (0,0).
  const nodes: Node[] = graph.nodes.map((node) => {
    const p = pos.get(node.id) ?? { x: 0, y: 0 };
    return {
      id: node.id,
      type: node.track === "expression" ? "expr" : "block",
      position: p,
      data: { node },
    };
  });

  const edges: Edge[] = graph.edges.map((edge) => {
    const style = EDGE_STYLE[edge.kind];
    const sourceHandle = sourceHandleFor(edge.kind);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
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

  return { nodes, edges };
}
