/**
 * graphToFlow — adapte un `GraphModel` (projection agnostique, voir
 * ../shared/graph.ts) vers les `Node[]`/`Edge[]` de React Flow.
 *
 * Mise en page : auto-layout **complet** avec dagre (vertical, top-down) sur TOUS
 * les nœuds (blocs + expressions) et TOUTES les arêtes. Les arêtes structurelles
 * (exec/calls/branches) ont un poids fort pour garder la colonne d'exécution droite ;
 * les arêtes `expression` un poids faible. Les tailles déclarées à dagre viennent de
 * `nodeSize` (mêmes valeurs que le rendu) → aucun chevauchement.
 *
 * Nœuds custom : `block` (carte) et `expr` (pill) — voir ./nodes/.
 * Arêtes : style par `kind` (exec clair épais, data gris pointillé, branches).
 */

import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { EdgeKind, GraphModel } from "../shared";
import { nodeSize } from "./node-size";

export interface FlowModel {
  nodes: Node[];
  edges: Edge[];
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

// Les arêtes d'exécution structurent la colonne ; les data dependencies suivent.
const edgeWeight = (kind: EdgeKind): number => (kind === "expression" ? 1 : 3);

export function graphToFlow(graph: GraphModel): FlowModel {
  const sizes = new Map(graph.nodes.map((n) => [n.id, nodeSize(n)] as const));

  // Auto-layout dagre sur le graphe ENTIER (blocs + expressions).
  const layout = new dagre.graphlib.Graph();
  layout.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 72, marginx: 24, marginy: 24 });
  layout.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    const s = sizes.get(node.id)!;
    layout.setNode(node.id, { width: s.width, height: s.height });
  }
  for (const edge of graph.edges) {
    layout.setEdge(edge.source, edge.target, { weight: edgeWeight(edge.kind), minlen: 1 });
  }

  dagre.layout(layout);

  const nodes: Node[] = graph.nodes.map((node) => {
    const s = sizes.get(node.id)!;
    const p = layout.node(node.id);
    return {
      id: node.id,
      type: node.track === "expression" ? "expr" : "block",
      position: { x: p.x - s.width / 2, y: p.y - s.height / 2 },
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
