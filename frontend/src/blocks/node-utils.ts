import * as t from "@babel/types";
import _generate from "@babel/generator";
import type { GeneratorResult, GeneratorOptions } from "@babel/generator";
import type { Node } from "@babel/types";
import type { BinaryExpression, BinaryOperand, FunctionCallDetails, Param, VarDeclaration } from "./types";

const generate: (ast: Node, opts?: GeneratorOptions, code?: string) => GeneratorResult =
  typeof _generate === "function" ? _generate : (_generate as any).default;

function hasTypeAnnotation(
  node: t.Node,
): node is t.Identifier | t.AssignmentPattern | t.ObjectPattern | t.ArrayPattern | t.RestElement {
  return "typeAnnotation" in node;
}

// Returns true when a function parameter is typed or defaulted as a function:
//   (cb: () => void)       — TSFunctionType annotation
//   (cb = () => {})        — arrow/function expression as default value
export function isParamFunctionType(node: t.Node): boolean {
  if (hasTypeAnnotation(node)) {
    const annotation = (node as any).typeAnnotation;
    if (annotation?.type === "TSTypeAnnotation") {
      return annotation.typeAnnotation.type === "TSFunctionType";
    }
  }
  if (t.isAssignmentPattern(node)) {
    return t.isFunctionExpression(node.right) || t.isArrowFunctionExpression(node.right);
  }
  return false;
}

export function getTypeScriptType(node: t.Node): string {
  if (hasTypeAnnotation(node) && node.typeAnnotation) {
    const tsTypeAnnotation = node.typeAnnotation as t.TSTypeAnnotation;
    return generate(tsTypeAnnotation.typeAnnotation).code;
  }
  if (node.type === "AssignmentPattern") {
    return getTypeScriptType(node.left as t.FunctionParameter);
  }
  if (t.isVariableDeclarator(node)) {
    return getTypeScriptType(node.id);
  }
  return "any";
}

export function getLiteralValue(node: t.Node): string | null {
  if (!t.isLiteral(node) || !("value" in node)) return null;
  return node.value.toString();
}

export function getNodeNameOfTypeIdentifier(node: t.Node): string | null {
  if (t.isIdentifier(node)) return node.name;
  return null;
}

// Extracts a FunctionCallDetails from a CallExpression node (no scope needed).
function callExpressionToDetails(node: t.CallExpression): FunctionCallDetails {
  const args = node.arguments.map((arg) => ({
    name: t.isIdentifier(arg) ? arg.name : undefined,
    isAFunction: false,
    value: getLiteralValue(arg as t.Node) ?? undefined,
  }));
  return {
    order: node.start as number,
    calleeFunctionName: getNodeNameOfTypeIdentifier(node.callee) ?? "",
    arguments: args,
  };
}

// Converts one side of a binary expression to a structured BinaryOperand.
function binaryOperandFromNode(node: t.Node): BinaryOperand | null {
  if (t.isIdentifier(node)) return node.name;
  const lit = getLiteralValue(node);
  if (lit !== null) return lit;
  if (t.isCallExpression(node)) return callExpressionToDetails(node);
  if (t.isBinaryExpression(node)) return getInfoFromBinaryExpression(node);
  return null;
}

export function getInfoFromBinaryExpression(node: t.Node): BinaryExpression | null {
  if (!t.isBinaryExpression(node)) return null;
  const left = binaryOperandFromNode(node.left);
  const right = binaryOperandFromNode(node.right);
  if (left === null || right === null) return null;
  return { operator: node.operator, leftSideOfOperator: left, rightSideOfOperator: right };
}

export function getAssignmentPatternTypeInfo(node: t.Node): Param | null {
  if (!t.isAssignmentPattern(node)) return null;
  return {
    name: getNodeNameOfTypeIdentifier(node.left) ?? "",
    defaultValue: getLiteralValue(node.right) ?? "",
    type: getTypeScriptType(node.left),
  };
}

export function getInfoFromVariableDeclaratorType(node: t.Node): VarDeclaration | null {
  if (!t.isVariableDeclarator(node)) return null;
  return {
    name: getNodeNameOfTypeIdentifier(node.id) ?? "",
    value: getLiteralValue(node.init as t.Node) ?? "",
    type: getTypeScriptType(node),
  };
}