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
  TypeAnnotation,
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
  interfaceMembersFromNode,
} from "./node-utils";
import type { ReturnStatement } from "./types/returnStatement";
import type {
  FunctionDeclaration as NewFnDecl,
  FunctionValue as NewFnValue,
} from "./types/function";
import type { SwitchCase, SwitchStatement } from "./types/switch-case";
import type { Block, Statement } from "./types/globalType";
import type { InterfaceDeclaration } from "./types/interface";
import type { IfStatement } from "./types/ifStatement";
import type {
  DoWhileStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  WhileStatement,
} from "./types/loops";
import type { CatchClause, TryStatement } from "./types/tryCatch";

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
): VariableDeclaration {
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

export function getInterfaceDeclaration(
  path: NodePath<t.TSInterfaceDeclaration>,
): InterfaceDeclaration | null {
  const typesAnnotation: TypeAnnotation[] = [];

  path.node.extends?.forEach((e) => {
    const typeAnnotation = typeAnnotationFromNode(e);
    if (typeAnnotation) {
      typesAnnotation.push(typeAnnotation);
    }
  });

  return {
    kind: "interface-declaration",
    name: path.node.id.name,
    typeParams: typeParamsFromNode(path.node) ?? [],
    extends: typesAnnotation,
    members: interfaceMembersFromNode(path.node.body),
  };
}

export function getIfStatement(
  path: NodePath<t.IfStatement>,
): IfStatement | null {
  const condition = valueFromNode(path.node.test);
  if (!condition) return null;
  return {
    uid: path.scope.uid,
    kind: "if",
    condition,
    then: { kind: "block", content: [] },
  };
}

export function getWhileStatement(
  path: NodePath<t.WhileStatement>,
): WhileStatement | null {
  const condition = valueFromNode(path.node.test);
  if (!condition) return null;
  return {
    uid: path.scope.uid,
    kind: "while",
    condition,
    body: { kind: "block", content: [] },
  };
}

export function getDoWhileStatement(
  path: NodePath<t.DoWhileStatement>,
): DoWhileStatement | null {
  const condition = valueFromNode(path.node.test);
  if (!condition) return null;
  return {
    uid: path.scope.uid,
    kind: "do-while",
    condition,
    body: { kind: "block", content: [] },
  };
}

export function getForStatement(path: NodePath<t.ForStatement>): ForStatement {
  const node = path.node;

  let init: ForStatement["init"];
  const initPath = path.get("init");
  if (initPath.isVariableDeclaration()) {
    init = getVariablesDeclaration(initPath);
  } else if (node.init) {
    init = valueFromNode(node.init as t.Expression) ?? undefined;
  }

  const test = node.test ? (valueFromNode(node.test) ?? undefined) : undefined;
  const update = node.update
    ? (valueFromNode(node.update) ?? undefined)
    : undefined;

  return {
    uid: path.scope.uid,
    kind: "for",
    init,
    test,
    update,
    body: { kind: "block", content: [] },
  };
}

export function getForInStatement(
  path: NodePath<t.ForInStatement>,
): ForInStatement | null {
  const right = valueFromNode(path.node.right);
  if (!right) return null;

  const leftPath = path.get("left");
  const left = leftPath.isVariableDeclaration()
    ? getVariablesDeclaration(leftPath)
    : assignmentTargetFromNode(path.node.left as t.LVal);
  if (!left) return null;

  return {
    uid: path.scope.uid,
    kind: "for-in",
    left,
    right,
    body: { kind: "block", content: [] },
  };
}

export function getForOfStatement(
  path: NodePath<t.ForOfStatement>,
): ForOfStatement | null {
  const right = valueFromNode(path.node.right);
  if (!right) return null;

  const leftPath = path.get("left");
  const left = leftPath.isVariableDeclaration()
    ? getVariablesDeclaration(leftPath)
    : assignmentTargetFromNode(path.node.left as t.LVal);
  if (!left) return null;

  return {
    uid: path.scope.uid,
    kind: "for-of",
    await: path.node.await,
    left,
    right,
    body: { kind: "block", content: [] },
  };
}

export function getTryStatement(path: NodePath<t.TryStatement>): TryStatement {
  return {
    uid: path.scope.uid,
    kind: "try",
    block: { kind: "block", content: [] },
  };
}

export function getCatchClause(path: NodePath<t.CatchClause>): CatchClause {
  const paramNode = path.node.param;
  const param =
    paramNode &&
    (t.isIdentifier(paramNode) ||
      t.isArrayPattern(paramNode) ||
      t.isObjectPattern(paramNode))
      ? (bindingTargetFromPattern(paramNode) ?? undefined)
      : undefined;

  return {
    kind: "catch",
    param,
    body: { kind: "block", content: [] },
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
