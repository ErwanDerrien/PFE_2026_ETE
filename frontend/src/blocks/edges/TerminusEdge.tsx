/**
 * TerminusEdge — arête entre un nœud START terminus et le premier statement exécuté.
 * Identique à InsertableEdge mais appelle requestInsert({ kind: "before", nodeId })
 * au lieu de { kind: "edge" }, puisque l'arête terminus n'existe pas dans graph.edges.
 */

import { useState, type MouseEvent } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useHoveredEdge, useRequestInsert } from "./insertion-context";

export default function TerminusEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const peerId = (data as Record<string, unknown> | undefined)?.peerId as string | undefined;
  const requestInsert = useRequestInsert();
  const hoveredEdgeId = useHoveredEdge();
  const [hoverBtn, setHoverBtn] = useState(false);
  const show = hoveredEdgeId === id || hoverBtn;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  const onAdd = (e: MouseEvent) => {
    e.stopPropagation();
    if (!peerId) return;
    requestInsert({ kind: "before", nodeId: peerId }, { x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          className={`edge-insert-wrap${show ? " is-visible" : ""}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onMouseEnter={() => setHoverBtn(true)}
          onMouseLeave={() => setHoverBtn(false)}
        >
          <button
            type="button"
            className="edge-insert-btn nodrag nopan"
            title="Ajouter un bloc"
            onClick={onAdd}
          >
            +
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
