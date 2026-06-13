import { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type {
  BinaryExpression as BinaryExpressionType,
  FunctionCallDetails,
  FunctionDetails,
  Param,
} from "./types";
import type {
  AssignmentExpression,
  AssignmentOperator,
  VariableDeclaration,
  DeclarationKind,
} from "./types/variable";
import {
  callExpressionToDetails,
  extractNodeValue,
  getAssignmentPatternTypeInfo,
  getNodeNameOfTypeIdentifier,
  getTypeScriptType,
  isParamFunctionType,
  valueFromNode,
  assignmentTargetFromNode,
  bindingTargetFromPattern,
  typeAnnotationFromNode,
  typeParamsFromNode,
  returnTypeFromNode,
  paramsToParameters,
} from "./node-utils";
import type { ReturnStatement } from "./types/returnStatement";
import type {
  FunctionDeclaration as NewFnDecl,
  FunctionValue as NewFnValue,
} from "./types/function";
import type { SwitchCase, SwitchStatement } from "./types/switch-case";
import type { Statement } from "./types/globalType";

export function getFunctionCallInfo(
  path: NodePath<t.CallExpression | t.ReturnStatement>,
): FunctionCallDetails | null {
  let node: t.Node = path.node;
  if (path.isReturnStatement()) {
    if (!path.node.argument) return null;
    node = path.node.argument;
  }
  if (node.type !== "CallExpression") return null;
  const details = callExpressionToDetails(node as t.CallExpression);
  return details.calleeFunctionName ? details : null;
}

// Returns a VariableDeclaration covering all patterns:
//   const x = 1
//   const [a, b] = arr
//   const { p, q: r } = obj
//   let a = 1, b: number = 2
export function getVariablesDeclaration(
  path: NodePath<t.VariableDeclaration>,
): VariableDeclaration & {
  order: number;
  blockParentId: number;
  isGlobal: boolean;
} {
  const declarations = path.get("declarations").flatMap((decl) => {
    const node = decl.node as t.VariableDeclarator;
    const nodeId = node.id;
    if (
      !t.isIdentifier(nodeId) &&
      !t.isArrayPattern(nodeId) &&
      !t.isObjectPattern(nodeId)
    )
      return [];
    const target = bindingTargetFromPattern(nodeId);
    if (!target) return [];
    const init = node.init ? valueFromNode(node.init) : undefined;
    const type = typeAnnotationFromNode(node);
    return [{ target, init: init ?? undefined, type }];
  });

  return {
    kind: "variable-declaration",
    declarationKind: path.node.kind as DeclarationKind,
    declarations,
    order: path.node.start as number,
    blockParentId: path.scope.uid,
    isGlobal: path.scope.block.type === "Program",
  };
}

export type FunctionLikePath = NodePath<
  t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
>;

export function getParamsFromFunctionLike(path: FunctionLikePath): Param[] {
  return path.node.params.map((param: t.FunctionParameter) => {
    const isAFunction = isParamFunctionType(param);
    const paramObj = getAssignmentPatternTypeInfo(param);
    if (paramObj) return { ...paramObj, isAFunction };
    return {
      name: getNodeNameOfTypeIdentifier(param) ?? "",
      type: getTypeScriptType(param),
      isAFunction,
    };
  });
}

export function getSwitchStatement(
  path: NodePath<t.SwitchStatement>,
): SwitchStatement | null {
  console.log("path.node", path.node);
  const discriminant = valueFromNode(path.node.discriminant);
  if (!discriminant) return null;

  return {
    uid: path.scope.uid,
    kind: "switch",
    discriminant,
    cases: [],
  };
}

export function getSwitchCase(path: NodePath<t.SwitchCase>): SwitchCase | null {
  if (!path.node.test) {
    return { uid: path.scope.uid, kind: "default", body: [] };
  }
  const test = valueFromNode(path.node.test);
  if (!test) return null;
  return {
    uid: path.scope.uid,
    kind: "case",
    test,
    body: [],
  };
}

// For each argument of a call expression, check via scope bindings whether it
// resolves to a function declaration/expression/arrow, and flag it accordingly.
export function markFunctionArguments(
  path: NodePath<t.CallExpression>,
  callDetails: FunctionCallDetails,
): void {
  path.node.arguments.forEach((arg) => {
    if (!t.isIdentifier(arg)) return;
    const binding = path.scope.getBinding(arg.name);
    if (
      binding?.path.isFunctionDeclaration() ||
      binding?.path.isFunctionExpression() ||
      binding?.path.isArrowFunctionExpression()
    ) {
      const argObj = callDetails.arguments.find((a) => a.name === arg.name);
      if (argObj) argObj.isAFunction = true;
    }
  });
}

export function processArrowFunctionReturn(
  path: NodePath<t.ArrowFunctionExpression>,
  scope: FunctionDetails | undefined,
) {
  if (!scope) return;
  const body = path.get("body");
  if (body.isBlockStatement()) return;
  const returnStatement: ReturnStatement = {
    kind: "return",
    blockUid: scope.scopreUid,
  };
  const val = valueFromNode(path.node);
  if (val) returnStatement.value = val;
  scope.return = returnStatement;
}

export function extractReturnStatement(
  path: NodePath<t.ReturnStatement>,
  scope: FunctionDetails | undefined,
) {
  if (!scope) return;

  const returnStatement: ReturnStatement = {
    kind: "return",
    blockUid: scope.scopreUid,
  };

  const val = valueFromNode(path.node.argument);
  if (val) returnStatement.value = val;

  scope.return = returnStatement;
}

export function extractRhsValue(
  exprPath: NodePath<t.Expression>,
): string | FunctionCallDetails | BinaryExpressionType | null {
  if (exprPath.isCallExpression()) return getFunctionCallInfo(exprPath);
  return extractNodeValue(exprPath.node);
}

function getFunctionName(path: FunctionLikePath): string {
  const node = path.node;
  if ("id" in node && node.id) return (node.id as t.Identifier).name;
  if (path.parentPath?.isVariableDeclarator()) {
    const id = (path.parentPath.node as t.VariableDeclarator).id;
    if (t.isIdentifier(id)) return id.name;
  }
  return "<anonymous>";
}

export function buildFunctionDeclaration(
  path: NodePath<t.FunctionDeclaration>,
): NewFnDecl {
  return {
    uid: path.scope.uid,
    kind: "function-declaration",
    name: getFunctionName(path as FunctionLikePath),
    typeParams: typeParamsFromNode(path.node),
    params: paramsToParameters(path.node.params),
    returnType: returnTypeFromNode(path.node),
    async: path.node.async,
    generator: path.node.generator ?? false,
    body: { kind: "block", content: [] },
  };
}

export function buildFunctionValue(
  path: FunctionLikePath,
  isArrow: boolean,
): NewFnValue {
  const node = path.node;
  const isExpressionBody =
    isArrow &&
    t.isArrowFunctionExpression(node) &&
    !t.isBlockStatement(node.body);
  const body = isExpressionBody
    ? (valueFromNode(
        (node as t.ArrowFunctionExpression).body as t.Expression,
      ) ?? { kind: "block" as const, content: [] })
    : { kind: "block" as const, content: [] };
  return {
    uid: path.scope.uid,
    kind: "function",
    name: getFunctionName(path),
    typeParams: typeParamsFromNode(node),
    params: paramsToParameters(node.params),
    returnType: returnTypeFromNode(node),
    async: node.async,
    generator: "generator" in node ? (node.generator ?? false) : false,
    arrow: isArrow,
    body,
  };
}

// Returns an AssignmentExpression covering all left-hand-side patterns:
//   x = 5
//   x += 10
//   obj.prop = val
//   arr[0] = val
//   [a, b] = arr
//   ({ p, q } = obj)
export function getAssignmentExpression(
  path: NodePath<t.AssignmentExpression>,
): (AssignmentExpression & { order: number; blockParentId: number }) | null {
  const node = path.node;
  const left = assignmentTargetFromNode(node.left);
  const right = valueFromNode(node.right);
  if (!left || !right) return null;
  return {
    kind: "assignment",
    operator: node.operator as AssignmentOperator,
    assignmentTargetName: left,
    assignmentTargetValue: right,
    order: node.start as number,
    blockParentId: path.scope.uid,
  };
}
