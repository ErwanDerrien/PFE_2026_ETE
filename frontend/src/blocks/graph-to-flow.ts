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
import type { EdgeKind } from "../shared";
import { nodeSize } from "./node-size";
import type { TypedGraphModel } from "./typed-nodes";

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

export function graphToFlow(graph: TypedGraphModel): FlowModel {
  const sizes = new Map(graph.nodes.map((n) => [n.id, nodeSize(n)] as const));

  const layout = new dagre.graphlib.Graph();
  layout.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 100, marginx: 48, marginy: 48 });
  layout.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    const s = sizes.get(node.id)!;
    layout.setNode(node.id, { width: s.width, height: s.height });
  }
  for (const edge of graph.edges) {
    const minlen = edge.kind === "loop-back" ? 0 : 1;
    layout.setEdge(edge.source, edge.target, { weight: edgeWeight(edge.kind), minlen });
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

  const SMOOTHSTEP_KINDS = new Set<EdgeKind>(["exec", "branch-true", "branch-false", "calls", "function-body", "loop-back"]);

  const edges: Edge[] = graph.edges.map((edge) => {
    const style = EDGE_STYLE[edge.kind];
    const sourceHandle = sourceHandleFor(edge.kind);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(SMOOTHSTEP_KINDS.has(edge.kind) ? { type: "smoothstep", pathOptions: { borderRadius: 12 } } : {}),
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
