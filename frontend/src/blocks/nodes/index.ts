import type { NodeTypes } from "@xyflow/react";
import BlockNode from "./BlockNode";
import ExpressionNode from "./ExpressionNode";
import TerminusNode from "./TerminusNode";

export const nodeTypes: NodeTypes = {
  block: BlockNode,
  expr: ExpressionNode,
  terminus: TerminusNode,
};
