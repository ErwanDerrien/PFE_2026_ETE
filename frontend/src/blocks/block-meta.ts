/**
 * block-meta — libellé, icône (glyphe) et couleur d'accent par type de bloc.
 * Indexé par `astType` (plus fin que les 5 rôles), avec repli par `role`.
 */

import type { NodeRole } from "../shared";

export interface BlockMeta {
  label: string;
  icon: string;
  accent: string;
}

const BY_AST_TYPE: Record<string, BlockMeta> = {
  FunctionDeclaration: { label: "FUNCTION", icon: "ƒ", accent: "#c084fc" },
  FunctionExpression: { label: "FUNCTION", icon: "ƒ", accent: "#c084fc" },
  ArrowFunctionExpression: { label: "FUNCTION", icon: "ƒ", accent: "#c084fc" },
  VariableDeclaration: { label: "VARIABLE", icon: "{ }", accent: "#2dd4bf" },
  IfStatement: { label: "CONDITION", icon: "⋔", accent: "#fb7185" },
  SwitchStatement: { label: "SWITCH", icon: "⋔", accent: "#fb7185" },
  ReturnStatement: { label: "RETURN", icon: "↵", accent: "#60a5fa" },
  WhileStatement: { label: "LOOP", icon: "↻", accent: "#f59e0b" },
  DoWhileStatement: { label: "LOOP", icon: "↻", accent: "#f59e0b" },
  ForStatement: { label: "LOOP", icon: "↻", accent: "#f59e0b" },
  ForInStatement: { label: "LOOP", icon: "↻", accent: "#f59e0b" },
  ForOfStatement: { label: "LOOP", icon: "↻", accent: "#f59e0b" },
  ExpressionStatement: { label: "CALL", icon: "( )", accent: "#2dd4bf" },
  CallExpression: { label: "CALL", icon: "( )", accent: "#2dd4bf" },
  AssignmentExpression: { label: "ASSIGN", icon: "=", accent: "#2dd4bf" },
  ThrowStatement: { label: "THROW", icon: "!", accent: "#f87171" },
  TryStatement: { label: "TRY", icon: "⚠", accent: "#f59e0b" },
  BreakStatement: { label: "BREAK", icon: "⊘", accent: "#94a3b8" },
  ContinueStatement: { label: "CONTINUE", icon: "↳", accent: "#94a3b8" },
  TSInterfaceDeclaration: { label: "INTERFACE", icon: "⌬", accent: "#c084fc" },
};

const BY_ROLE: Record<NodeRole, BlockMeta> = {
  boundary: { label: "FUNCTION", icon: "ƒ", accent: "#c084fc" },
  control: { label: "CONTROL", icon: "⋔", accent: "#fb7185" },
  statement: { label: "STATEMENT", icon: "▪", accent: "#2dd4bf" },
  expression: { label: "EXPR", icon: "ƒx", accent: "#fb7185" },
  literal: { label: "VALUE", icon: "•", accent: "#94a3b8" },
};

export function blockMeta(astType: string, role: NodeRole): BlockMeta {
  return BY_AST_TYPE[astType] ?? BY_ROLE[role];
}

const BRANCHING = new Set(["IfStatement", "SwitchStatement"]);

export const isBranching = (astType: string): boolean => BRANCHING.has(astType);
