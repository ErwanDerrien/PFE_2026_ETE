/**
 * BlockNode — carte d'un statement de la spine : en-tête typé (libellé + icône,
 * accent coloré) + ligne de code surlignée. Les conditions (if/switch) ont un
 * pied TRUE/FALSE. Handles : target haut, source bas (exec/calls), source droite
 * "data" (expression), et pour les conditions source "true"/"false".
 */

import type { CSSProperties } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { GraphNode } from "../../shared";
import { blockMeta, isBranching } from "../block-meta";
import { highlight } from "../highlight";

export type BlockData = { node: GraphNode };
export type BlockFlowNode = Node<BlockData, "block">;

export default function BlockNode({ data, selected }: NodeProps<BlockFlowNode>) {
  const node = data.node;
  const meta = blockMeta(node.astType, node.role);
  const branching = isBranching(node.astType);
  const code = node.source ?? node.label;

  return (
    <div
      className={`bn role-${node.role}${branching ? " bn-branch" : ""}${selected ? " is-selected" : ""}`}
      style={{ "--accent": meta.accent } as CSSProperties}
    >
      <Handle type="target" position={Position.Top} className="bn-handle" />

      <header className="bn-head">
        <span className="bn-type">{meta.label}</span>
        <span className="bn-icon">{meta.icon}</span>
      </header>

      <div className="bn-body">
        <code>{highlight(code)}</code>
      </div>

      {branching && (
        <footer className="bn-foot">
          <div className="bn-foot-cell bn-foot-true">
            TRUE
            <Handle
              id="true"
              type="source"
              position={Position.Bottom}
              className="bn-handle bn-handle-true"
            />
          </div>
          <div className="bn-foot-cell bn-foot-false">
            FALSE
            <Handle
              id="false"
              type="source"
              position={Position.Bottom}
              className="bn-handle bn-handle-false"
            />
          </div>
        </footer>
      )}

      {/* exec out (flux d'exécution vers le statement suivant) */}
      <Handle type="source" position={Position.Bottom} className="bn-handle bn-handle-exec" />
      {/* dépendance de données (expressions à droite) */}
      <Handle id="data" type="source" position={Position.Right} className="bn-handle bn-handle-data" />
    </div>
  );
}
