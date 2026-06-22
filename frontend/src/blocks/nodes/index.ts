import type { NodeTypes } from "@xyflow/react";
import BlockNode from "./BlockNode";
import ExpressionNode from "./ExpressionNode";

export const nodeTypes: NodeTypes = {
  block: BlockNode,
  expr: ExpressionNode,
};
