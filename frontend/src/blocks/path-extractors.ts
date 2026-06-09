import { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type {
  BinaryExpression as BinaryExpressionType,
  Expression,
  FunctionCallDetails,
  FunctionDetails,
  Param,
  ReturnStatement,
  VarDeclaration,
  VariableAssignement,
} from "./types";
import {
  getAssignmentPatternTypeInfo,
  getInfoFromBinaryExpression,
  getInfoFromVariableDeclaratorType,
  getLiteralValue,
  getNodeNameOfTypeIdentifier,
  getTypeScriptType,
  isParamFunctionType,
} from "./node-utils";

export function getFunctionCallInfo(
  path: NodePath<t.CallExpression | t.ReturnStatement>,
): FunctionCallDetails | null {
  let node = path.node;
  if (path.isReturnStatement() && path.node.argument != undefined) {
    node = path.node.argument as t.CallExpression;
  }
  const order = path.node.start as number;
  if (node == undefined || node.type !== "CallExpression") return null;

  const args = node.arguments.map((arg) => {
    const value = getLiteralValue(arg as t.Node);
    return {
      name: t.isIdentifier(arg) ? arg.name : undefined,
      isAFunction: false,
      value: value ?? undefined,
    };
  });

  const calleeName = getNodeNameOfTypeIdentifier(node.callee);
  if (!calleeName) return null;

  return { arguments: args, calleeFunctionName: calleeName, order };
}

export function getVariablesDeclaration(
  path: NodePath<t.VariableDeclaration>,
): Expression {
  const varList: VarDeclaration[] = [];
  const currentScope = path.scope;

  path.get("declarations").forEach((decl) => {
    const variable = getInfoFromVariableDeclaratorType(
      decl.node as t.VariableDeclarator,
    );
    if (!variable) return;

    const callFunctionDetails = getFunctionCallInfo(
      decl.get("init") as NodePath<t.CallExpression>,
    );
    if (callFunctionDetails) variable.value = callFunctionDetails;

    varList.push(variable);
  });

  return {
    order: path.node.start as number,
    scope: path.node.kind,
    variables: varList,
    blockParentId: currentScope.uid,
    isGlobal: currentScope.block.type === "Program",
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
  const returnStatement: ReturnStatement = { blockUid: scope.scopreUid };
  const impliciteReturnExpression = body.node;
  const binary = getInfoFromBinaryExpression(
    impliciteReturnExpression as t.Expression,
  );

  returnStatement.expression = binary ?? undefined;

  if (body.isCallExpression()) {
    const callDetails = getFunctionCallInfo(body);
    returnStatement.functionCallDetails = callDetails ?? undefined;
  }
  scope.return = returnStatement;
}

export function extractReturnStatement(
  path: NodePath<t.ReturnStatement>,
  scope: FunctionDetails | undefined,
) {
  if (!scope) return;

  const returnStatement: ReturnStatement = { blockUid: scope.scopreUid };
  const binary = getInfoFromBinaryExpression(
    path.node.argument as t.Expression,
  );
  const callDetails = getFunctionCallInfo(path);

  if (binary) {
    returnStatement.expression = binary;
  } else if (callDetails) {
    markFunctionArguments(
      path.get("argument") as NodePath<t.CallExpression>,
      callDetails,
    );
    returnStatement.functionCallDetails = callDetails;
  }

  scope.return = returnStatement;
}

// Maps a right-hand side expression type to a function that extracts its value.
type RhsExtractor = (
  exprPath: NodePath<t.Expression>,
) => string | FunctionCallDetails | BinaryExpressionType | null;

const rhsExtractorMap: Partial<Record<string, RhsExtractor>> = {
  NumericLiteral: (p) => String((p.node as t.NumericLiteral).value),
  StringLiteral: (p) => (p.node as t.StringLiteral).value,
  BooleanLiteral: (p) => String((p.node as t.BooleanLiteral).value),
  Identifier: (p) => (p.node as t.Identifier).name,
  CallExpression: (p) => getFunctionCallInfo(p as NodePath<t.CallExpression>),
  BinaryExpression: (p) => getInfoFromBinaryExpression(p.node),
  MemberExpression: (_p) => null, // TODO: e.g. obj.prop
};

export function extractRhsValue(
  exprPath: NodePath<t.Expression>,
): string | FunctionCallDetails | BinaryExpressionType | null {
  const extractor = rhsExtractorMap[exprPath.node.type];
  if (!extractor) return null;
  return extractor(exprPath);
}

type AssignmentHandler = (
  path: NodePath<t.AssignmentExpression>,
) => VariableAssignement | null;

function handleSimpleAssignment(
  path: NodePath<t.AssignmentExpression>,
): VariableAssignement | null {
  const node = path.node;
  const left = node.left as t.Identifier;
  const value = extractRhsValue(path.get("right") as NodePath<t.Expression>);
  return {
    blockParentId: path.scope.uid,
    order: node.start as number,
    name: left.name,
    value: value ?? "",
    type: getTypeScriptType(left),
    operator: node.operator,
  };
}

function handleMemberExpressionAssignment(
  _path: NodePath<t.AssignmentExpression>,
): VariableAssignement | null {
  // TODO: implement - e.g. obj.prop = value, obj.nested.value = 10
  return null;
}

function handleArrayPatternAssignment(
  _path: NodePath<t.AssignmentExpression>,
): VariableAssignement | null {
  // TODO: implement - e.g. [a, b] = [1, 2]
  return null;
}

function handleObjectPatternAssignment(
  _path: NodePath<t.AssignmentExpression>,
): VariableAssignement | null {
  // TODO: implement - e.g. ({ p, q } = { p: 3, q: 4 })
  return null;
}

const assignmentHandlerMap: Partial<Record<string, AssignmentHandler>> = {
  Identifier: handleSimpleAssignment,
  MemberExpression: handleMemberExpressionAssignment,
  ArrayPattern: handleArrayPatternAssignment,
  ObjectPattern: handleObjectPatternAssignment,
};

export function getAssignmentExpression(
  path: NodePath<t.AssignmentExpression>,
): VariableAssignement | null {
  const handler = assignmentHandlerMap[path.node.left.type];
  if (!handler) return null;
  return handler(path);
}
