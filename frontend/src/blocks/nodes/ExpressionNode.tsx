/**
 * ExpressionNode — pill compacte pour les sous-arbres d'expression (track latéral).
 * Discrète : corail si compound, gris si feuille (literal/variable).
 * Handles : target gauche, source droite "data" (expressions imbriquées).
 */

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { GraphNode } from "../../shared";
import { highlight } from "../highlight";

export type ExprData = { node: GraphNode };
export type ExprFlowNode = Node<ExprData, "expr">;

export default function ExpressionNode({ data }: NodeProps<ExprFlowNode>) {
  const node = data.node;
  const leaf = node.role === "literal";

  return (
    <div className={`xn ${leaf ? "xn-leaf" : "xn-expr"}`}>
      <Handle type="target" position={Position.Left} className="xn-handle" />
      <code>{highlight(node.label)}</code>
      <Handle id="data" type="source" position={Position.Right} className="xn-handle" />
    </div>
  );
}
