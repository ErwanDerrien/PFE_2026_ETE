/**
 * InsertableEdge — arête de flux avec un bouton « + » qui apparaît au survol.
 * Cliquer ouvre la palette de blocs (via InsertionContext) ; le bloc choisi est
 * inséré en scindant cette arête (voir `insertNodeOnEdge`).
 *
 * Le tracé reprend le `smoothstep` du rendu standard. Une zone invisible large
 * superposée au tracé capte le survol même si l'arête est fine.
 */

import { useState, type MouseEvent } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { useHoveredEdge, useRequestInsert } from "./insertion-context";

export default function InsertableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
}: EdgeProps) {
  const requestInsert = useRequestInsert();
  const hoveredEdgeId = useHoveredEdge();
  const [hoverBtn, setHoverBtn] = useState(false);
  // Survol de l'arête détecté par React Flow (fiable) OU survol du bouton lui-même
  // (pour qu'il reste visible quand on déplace le curseur de l'arête vers le +).
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
    requestInsert({ kind: "edge", edgeId: id }, { x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="edge-flow-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 14}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
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
