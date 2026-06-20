import * as t from "@babel/types";
import _generate from "@babel/generator";
import type { GeneratorResult, GeneratorOptions } from "@babel/generator";
import type { Node } from "@babel/types";
import type {
  BinaryExpression,
  BinaryOperand,
  FunctionCallDetails,
  Param,
  VarDeclaration,
} from "./types";
import type {
  AssignmentOperator,
  AssignmentTarget,
  BindingTarget,
  ArrayDestructure,
  ObjectDestructure,
  DestructuredProp,
  DefaultedTarget,
  Rest,
  Spread,
  TypeAnnotation,
  PrimitiveType,
} from "./types/variable";
import type { Value } from "./types/globalType";
import type { Argument, Callee } from "./types/functionCall";
import type { TypeParam, Parameter } from "./types/parameter";
import type { InterfaceMember } from "./types/interface";

export const generate: (
  ast: Node,
  opts?: GeneratorOptions,
  code?: string,
) => GeneratorResult =
  typeof _generate === "function" ? _generate : (_generate as any).default;

function hasTypeAnnotation(
  node: t.Node,
): node is
  | t.Identifier
  | t.AssignmentPattern
  | t.ObjectPattern
  | t.ArrayPattern
  | t.RestElement {
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
    return (
      t.isFunctionExpression(node.right) ||
      t.isArrowFunctionExpression(node.right)
    );
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
export function callExpressionToDetails(
  node: t.CallExpression,
): FunctionCallDetails {
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

export function getInfoFromBinaryExpression(
  node: t.Node,
): BinaryExpression | null {
  if (!t.isBinaryExpression(node)) return null;
  const left = binaryOperandFromNode(node.left);
  const right = binaryOperandFromNode(node.right);
  if (left === null || right === null) return null;
  return {
    operator: node.operator,
    leftSideOfOperator: left,
    rightSideOfOperator: right,
  };
}

export function getAssignmentPatternTypeInfo(node: t.Node): Param | null {
  if (!t.isAssignmentPattern(node)) return null;
  return {
    name: getNodeNameOfTypeIdentifier(node.left) ?? "",
    defaultValue: getLiteralValue(node.right) ?? "",
    type: getTypeScriptType(node.left),
  };
}

export function getInfoFromVariableDeclaratorType(
  node: t.Node,
): VarDeclaration | null {
  if (!t.isVariableDeclarator(node)) return null;
  return {
    name: getNodeNameOfTypeIdentifier(node.id) ?? "",
    value: getLiteralValue(node.init as t.Node) ?? "",
    type: getTypeScriptType(node),
  };
}

export function extractNodeValue(
  node: t.Node,
): string | BinaryExpression | null {
  if (t.isLiteral(node) && "value" in node) return String(node.value);
  if (t.isIdentifier(node)) return node.name;
  if (t.isBinaryExpression(node)) return getInfoFromBinaryExpression(node);
  return null;
}

export function extractMemberPath(node: t.MemberExpression): {
  object: string;
  property: string[];
} {
  const property: string[] = [];
  let current: t.Expression = node;

  while (t.isMemberExpression(current)) {
    const nodeValue = extractNodeValue(current.property);
    if (typeof nodeValue === "string") {
      property.unshift(nodeValue);
    } else {
      property.unshift((current.property as t.Identifier).name);
    }
    current = current.object as t.Expression;
  }

  return { object: (current as t.Identifier).name, property };
}

// ─── Rich AST → variable.ts type helpers ────────────────────────────────────

function valueFromLiteralNode(node: t.Expression): Value | null {
  if (t.isStringLiteral(node))
    return { kind: "literal", value: node.value, type: "string" };
  if (t.isNumericLiteral(node))
    return { kind: "literal", value: node.value, type: "number" };
  if (t.isBooleanLiteral(node))
    return { kind: "literal", value: node.value, type: "boolean" };
  if (t.isNullLiteral(node))
    return { kind: "literal", value: null, type: "null" };
  if (t.isBigIntLiteral(node))
    return { kind: "literal", value: `${node.value}n`, type: "bigint" };
  if (t.isRegExpLiteral(node))
    return {
      kind: "literal",
      value: `/${node.pattern}/${node.flags}`,
      type: "regexp",
    };
  return null;
}

function valueFromMemberNode(
  node: t.MemberExpression | t.OptionalMemberExpression,
): Value | null {
  const obj = valueFromNode(node.object);
  if (!obj) return null;
  const optional = node.optional ?? false;
  if (!node.computed && t.isIdentifier(node.property)) {
    return {
      kind: "property",
      object: obj,
      property: node.property.name,
      optional,
    };
  }
  const index = valueFromNode(node.property as t.Expression);
  if (!index) return null;
  return { kind: "index", object: obj, index, optional };
}

function valueFromCallNode(
  node: t.CallExpression | t.OptionalCallExpression,
): Value | null {
  const callee = valueFromNode(node.callee as t.Expression);
  if (!callee) return null;
  const args: Argument[] = [];
  for (const arg of node.arguments) {
    if (t.isSpreadElement(arg)) {
      const v = valueFromNode(arg.argument);
      if (v) args.push({ kind: "spread-arg", value: v });
    } else {
      const v = valueFromNode(arg as t.Expression);
      if (v) args.push(v);
    }
  }
  const optional = t.isOptionalCallExpression(node)
    ? node.optional
    : ((node as any).optional ?? false);
  return {
    kind: "call",
    callee: callee as Callee,
    typeArgs: [],
    args,
    optional,
  };
}

function valueFromFunctionNode(
  node: t.FunctionExpression | t.ArrowFunctionExpression,
): Value {
  const isArrow = t.isArrowFunctionExpression(node);
  const isExpressionBody = isArrow && !t.isBlockStatement(node.body);
  const body = isExpressionBody
    ? (valueFromNode(
        (node as t.ArrowFunctionExpression).body as t.Expression,
      ) ?? { kind: "block" as const, content: [] })
    : { kind: "block" as const, content: [] };
  return {
    kind: "function",
    name: "id" in node && node.id ? (node.id as t.Identifier).name : undefined,
    typeParams: typeParamsFromNode(node),
    params: paramsToParameters(node.params),
    returnType: returnTypeFromNode(node),
    async: node.async,
    generator: "generator" in node ? (node.generator ?? false) : false,
    arrow: isArrow,
    body,
  };
}

function valueFromArrayNode(node: t.ArrayExpression): Value {
  const elements = (
    node.elements as (t.Expression | t.SpreadElement | null)[]
  ).map((el) => {
    if (el === null) return null;
    if (t.isSpreadElement(el)) {
      const v = valueFromNode(el.argument);
      return v ? ({ kind: "spread", value: v } as Spread) : null;
    }
    return valueFromNode(el);
  });
  return { kind: "array", elements };
}

function valueFromObjectNode(node: t.ObjectExpression): Value {
  const properties: { key: string; value: Value }[] = [];
  for (const prop of node.properties) {
    if (!t.isObjectProperty(prop)) continue;
    const key = prop.computed
      ? generate(prop.key).code
      : t.isIdentifier(prop.key)
        ? prop.key.name
        : t.isStringLiteral(prop.key)
          ? prop.key.value
          : t.isNumericLiteral(prop.key)
            ? String(prop.key.value)
            : generate(prop.key).code;
    if (!t.isExpression(prop.value)) continue;
    const val = valueFromNode(prop.value);
    if (val) properties.push({ key, value: val });
  }
  return { kind: "object", properties };
}

function valueFromTemplateNode(node: t.TemplateLiteral): Value {
  const quasis = node.quasis.map((q) => q.value.cooked ?? q.value.raw);
  const expressions: Value[] = [];
  for (const expr of node.expressions) {
    const v = valueFromNode(expr as t.Expression);
    if (v) expressions.push(v);
  }
  return { kind: "template", quasis, expressions };
}

// Converts any expression AST node to the Value union from variable.ts.
export function valueFromNode(
  node: t.Expression | null | undefined,
): Value | null {
  if (!node) return null;

  const literal = valueFromLiteralNode(node);
  if (literal) return literal;

  if (t.isIdentifier(node)) return { kind: "variable", name: node.name };

  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node))
    return valueFromMemberNode(node);

  if (t.isCallExpression(node) || t.isOptionalCallExpression(node))
    return valueFromCallNode(node);

  if (t.isAssignmentExpression(node)) {
    const left = assignmentTargetFromNode(node.left);
    const right = valueFromNode(node.right);
    if (!left || !right) return null;
    return {
      kind: "assignment",
      operator: node.operator as AssignmentOperator,
      assignmentTargetName: left,
      assignmentTargetValue: right,
    };
  }

  if (t.isBinaryExpression(node)) {
    const left = valueFromNode(node.left as t.Expression);
    const right = valueFromNode(node.right);
    if (!left || !right) return null;
    return { kind: "binary", op: node.operator, left, right };
  }

  if (t.isLogicalExpression(node)) {
    const left = valueFromNode(node.left);
    const right = valueFromNode(node.right);
    if (!left || !right) return null;
    return { kind: "binary", op: node.operator, left, right };
  }

  if (t.isUnaryExpression(node)) {
    const val = valueFromNode(node.argument);
    if (!val) return null;
    return { kind: "unary", op: node.operator, value: val };
  }

  if (t.isUpdateExpression(node)) {
    const val = valueFromNode(node.argument);
    if (!val) return null;
    return { kind: "unary", op: node.operator, value: val };
  }

  if (t.isConditionalExpression(node)) {
    const condition = valueFromNode(node.test);
    const thenVal = valueFromNode(node.consequent);
    const elseVal = valueFromNode(node.alternate);
    if (!condition || !thenVal || !elseVal) return null;
    return { kind: "ternary", condition, then: thenVal, else: elseVal };
  }

  if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node))
    return valueFromFunctionNode(node);

  if (t.isArrayExpression(node)) return valueFromArrayNode(node);

  if (t.isObjectExpression(node)) return valueFromObjectNode(node);

  if (t.isTemplateLiteral(node)) return valueFromTemplateNode(node);

  if (t.isAwaitExpression(node)) {
    if (!node.argument) return null;
    const val = valueFromNode(node.argument);
    if (!val) return null;
    return { kind: "await", value: val };
  }

  if (t.isYieldExpression(node)) {
    const val = node.argument ? valueFromNode(node.argument) : null;
    return { kind: "yield", value: val, delegate: node.delegate };
  }

  return { kind: "literal", value: generate(node).code, type: "any" };
}

// Converts [a, b, ...rest] = ... to ArrayDestructure.
function arrayPatternToTarget(node: t.ArrayPattern): ArrayDestructure {
  const elements = node.elements.map(
    (el): AssignmentTarget | DefaultedTarget | Rest | null => {
      if (el === null) return null;
      if (t.isRestElement(el)) {
        const target = assignmentTargetFromNode(el.argument as t.LVal);
        return target ? ({ kind: "rest", target } as Rest) : null;
      }
      if (t.isAssignmentPattern(el)) {
        const target = assignmentTargetFromNode(el.left as t.LVal);
        const def = valueFromNode(el.right);
        if (!target || !def) return null;
        return { kind: "defaulted", target, default: def } as DefaultedTarget;
      }
      return assignmentTargetFromNode(el as t.LVal);
    },
  );
  return { kind: "array-destructure", elements } as ArrayDestructure;
}

// Converts { a, b: c, x = 5, ...rest } = ... to ObjectDestructure.
function objectPatternToTarget(node: t.ObjectPattern): ObjectDestructure {
  const properties: (DestructuredProp | Rest)[] = [];
  for (const prop of node.properties) {
    if (t.isRestElement(prop)) {
      const target = assignmentTargetFromNode(prop.argument as t.LVal);
      if (target) properties.push({ kind: "rest", target } as Rest);
      continue;
    }
    if (!t.isObjectProperty(prop)) continue;
    const key = t.isIdentifier(prop.key)
      ? prop.key.name
      : t.isStringLiteral(prop.key)
        ? prop.key.value
        : generate(prop.key).code;
    const val = prop.value;
    if (t.isAssignmentPattern(val)) {
      const leftName = t.isIdentifier(val.left) ? val.left.name : null;
      const def = valueFromNode(val.right);
      if (leftName && leftName !== key) {
        properties.push({
          kind: "prop",
          key,
          alias: leftName,
          default: def ?? undefined,
        });
      } else {
        properties.push({ kind: "prop", key, default: def ?? undefined });
      }
    } else if (t.isIdentifier(val)) {
      properties.push(
        prop.shorthand
          ? { kind: "prop", key }
          : { kind: "prop", key, alias: val.name },
      );
    } else if (t.isArrayPattern(val) || t.isObjectPattern(val)) {
      const nested = assignmentTargetFromNode(val);
      properties.push({ kind: "prop", key, nested: nested ?? undefined });
    } else {
      properties.push({ kind: "prop", key });
    }
  }
  return { kind: "object-destructure", properties } as ObjectDestructure;
}

// Converts an LVal (left-hand side of = or declaration) to AssignmentTarget.
export function assignmentTargetFromNode(
  node: t.LVal | t.Expression,
): AssignmentTarget | null {
  if (t.isIdentifier(node)) return { kind: "variable", name: node.name };

  if (t.isMemberExpression(node)) {
    const obj = valueFromNode(node.object);
    if (!obj) return null;
    if (!node.computed && t.isIdentifier(node.property)) {
      return { kind: "property", object: obj, property: node.property.name };
    }
    const index = valueFromNode(node.property as t.Expression);
    if (!index) return null;
    return { kind: "index", object: obj, index };
  }

  if (t.isArrayPattern(node)) return arrayPatternToTarget(node);
  if (t.isObjectPattern(node)) return objectPatternToTarget(node);

  return null;
}

// Converts a declaration LVal (no PropertyTarget / IndexTarget allowed) to BindingTarget.
export function bindingTargetFromPattern(node: t.LVal): BindingTarget | null {
  const target = assignmentTargetFromNode(node);
  if (!target) return null;
  if (
    target.kind === "variable" ||
    target.kind === "array-destructure" ||
    target.kind === "object-destructure"
  ) {
    return target as BindingTarget;
  }
  return null;
}

// Extracts the TS type annotation from a VariableDeclarator / Identifier / pattern.
export function typeAnnotationFromNode(
  node: t.Node,
): TypeAnnotation | undefined {
  const tsType = getTSTypeNode(node);
  return tsType ? tsTypeToAnnotation(tsType) : undefined;
}

function getTSTypeNode(node: t.Node): t.TSType | null {
  if (hasTypeAnnotation(node) && node.typeAnnotation) {
    return (node.typeAnnotation as t.TSTypeAnnotation).typeAnnotation;
  }
  if (t.isVariableDeclarator(node)) return getTSTypeNode(node.id);
  return null;
}

function primitiveKeywordAnnotation(tsType: t.TSType): TypeAnnotation | null {
  if (t.isTSStringKeyword(tsType)) return { kind: "primitive", name: "string" };
  if (t.isTSNumberKeyword(tsType)) return { kind: "primitive", name: "number" };
  if (t.isTSBooleanKeyword(tsType))
    return { kind: "primitive", name: "boolean" };
  if (t.isTSBigIntKeyword(tsType)) return { kind: "primitive", name: "bigint" };
  if (t.isTSSymbolKeyword(tsType)) return { kind: "primitive", name: "symbol" };
  if (t.isTSNullKeyword(tsType)) return { kind: "primitive", name: "null" };
  if (t.isTSUndefinedKeyword(tsType))
    return { kind: "primitive", name: "undefined" };
  if (t.isTSVoidKeyword(tsType)) return { kind: "primitive", name: "void" };
  if (t.isTSNeverKeyword(tsType)) return { kind: "primitive", name: "never" };
  if (t.isTSAnyKeyword(tsType)) return { kind: "primitive", name: "any" };
  if (t.isTSUnknownKeyword(tsType))
    return { kind: "primitive", name: "unknown" };
  return null;
}

function tsTypeToAnnotation(tsType: t.TSType): TypeAnnotation {
  const primitive = primitiveKeywordAnnotation(tsType);
  if (primitive) return primitive;

  if (t.isTSLiteralType(tsType)) {
    const lit = tsType.literal;
    if (t.isStringLiteral(lit))
      return { kind: "literal-type", value: lit.value };
    if (t.isNumericLiteral(lit))
      return { kind: "literal-type", value: lit.value };
    if (t.isBooleanLiteral(lit))
      return { kind: "literal-type", value: lit.value };
    return { kind: "type-reference", name: generate(tsType).code };
  }

  if (t.isTSUnionType(tsType))
    return { kind: "union", members: tsType.types.map(tsTypeToAnnotation) };
  if (t.isTSIntersectionType(tsType))
    return {
      kind: "intersection",
      members: tsType.types.map(tsTypeToAnnotation),
    };
  if (t.isTSArrayType(tsType))
    return { kind: "array", element: tsTypeToAnnotation(tsType.elementType) };

  if (t.isTSTupleType(tsType)) {
    const elements = tsType.elementTypes.map((el) =>
      "elementType" in el
        ? tsTypeToAnnotation((el as any).elementType)
        : tsTypeToAnnotation(el as t.TSType),
    );
    return { kind: "tuple", elements };
  }

  if (t.isTSTypeLiteral(tsType)) {
    const properties = tsType.members.flatMap((m) => {
      if (!t.isTSPropertySignature(m) || !m.typeAnnotation) return [];
      const keyName = t.isIdentifier(m.key)
        ? m.key.name
        : t.isStringLiteral(m.key)
          ? m.key.value
          : null;
      if (!keyName) return [];
      return [
        {
          key: keyName,
          value: tsTypeToAnnotation(m.typeAnnotation.typeAnnotation),
          optional: m.optional ?? false,
        },
      ];
    });
    return { kind: "object", properties };
  }

  if (t.isTSFunctionType(tsType)) {
    const params = tsType.parameters.map(
      (p: t.Identifier | t.RestElement | t.ArrayPattern | t.ObjectPattern) => {
        const name = t.isIdentifier(p) ? p.name : generate(p).code;
        const type = (p as any).typeAnnotation
          ? tsTypeToAnnotation((p as any).typeAnnotation.typeAnnotation)
          : ({ kind: "primitive", name: "any" } as PrimitiveType);
        return { name, type };
      },
    );
    const returns = tsType.typeAnnotation
      ? tsTypeToAnnotation(tsType.typeAnnotation.typeAnnotation)
      : ({ kind: "primitive", name: "void" } as PrimitiveType);
    return { kind: "function", params, returns };
  }

  if (t.isTSTypeReference(tsType)) {
    const name = t.isIdentifier(tsType.typeName)
      ? tsType.typeName.name
      : generate(tsType.typeName).code;
    if (tsType.typeParameters?.params.length) {
      const args = tsType.typeParameters.params.map(tsTypeToAnnotation);
      return { kind: "generic", base: { kind: "type-reference", name }, args };
    }
    return { kind: "type-reference", name };
  }

  return { kind: "type-reference", name: generate(tsType).code };
}

type FunctionLikeNode =
  | t.FunctionDeclaration
  | t.FunctionExpression
  | t.ArrowFunctionExpression;

type TypeParamNode =
  | FunctionLikeNode
  | t.TSInterfaceDeclaration
  | t.TSMethodSignature
  | t.TSCallSignatureDeclaration
  | t.TSConstructSignatureDeclaration;

export function typeParamsFromNode(node: TypeParamNode): TypeParam[] {
  if (
    !node.typeParameters ||
    !t.isTSTypeParameterDeclaration(node.typeParameters)
  )
    return [];
  return node.typeParameters.params.map((p) => ({
    name: p.name,
    constraint: p.constraint ? tsTypeToAnnotation(p.constraint) : undefined,
    default: p.default ? tsTypeToAnnotation(p.default) : undefined,
  }));
}

export function returnTypeFromNode(
  node: FunctionLikeNode,
): TypeAnnotation | undefined {
  if (!node.returnType || !t.isTSTypeAnnotation(node.returnType))
    return { kind: "primitive", name: "any" };
  return tsTypeToAnnotation(node.returnType.typeAnnotation);
}

function memberKeyName(key: t.Expression): string {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  if (t.isNumericLiteral(key)) return String(key.value);
  return generate(key).code;
}

function memberReturnType(
  ann: t.TSTypeAnnotation | null | undefined,
): TypeAnnotation {
  if (ann) return tsTypeToAnnotation(ann.typeAnnotation);
  return { kind: "primitive", name: "void" };
}

export function interfaceMembersFromNode(
  body: t.TSInterfaceBody,
): InterfaceMember[] {
  return body.body.flatMap((member): InterfaceMember[] => {
    if (t.isTSPropertySignature(member)) {
      const type = member.typeAnnotation
        ? tsTypeToAnnotation(member.typeAnnotation.typeAnnotation)
        : ({ kind: "primitive", name: "any" } as PrimitiveType);
      return [
        {
          kind: "property-signature",
          name: memberKeyName(member.key as t.Expression),
          optional: member.optional ?? false,
          readonly: member.readonly ?? false,
          type,
        },
      ];
    }

    if (t.isTSMethodSignature(member)) {
      return [
        {
          kind: "method-signature",
          name: memberKeyName(member.key as t.Expression),
          optional: member.optional ?? false,
          typeParams: typeParamsFromNode(member),
          params: paramsToParameters(
            member.parameters as t.FunctionParameter[],
          ),
          returnType: memberReturnType(member.typeAnnotation),
        },
      ];
    }

    if (t.isTSIndexSignature(member)) {
      const param = member.parameters[0];
      const keyName = t.isIdentifier(param) ? param.name : generate(param).code;
      const keyType = (param as any)?.typeAnnotation
        ? (tsTypeToAnnotation(
            (param as any).typeAnnotation.typeAnnotation,
          ) as PrimitiveType)
        : ({ kind: "primitive", name: "string" } as PrimitiveType);
      const valueType = member.typeAnnotation
        ? tsTypeToAnnotation(member.typeAnnotation.typeAnnotation)
        : ({ kind: "primitive", name: "any" } as PrimitiveType);
      return [
        {
          kind: "index-signature",
          keyName,
          keyType,
          valueType,
          readonly: member.readonly ?? false,
        },
      ];
    }

    if (t.isTSCallSignatureDeclaration(member)) {
      return [
        {
          kind: "call-signature",
          typeParams: typeParamsFromNode(member),
          params: paramsToParameters(
            member.parameters as t.FunctionParameter[],
          ),
          returnType: memberReturnType(member.typeAnnotation),
        },
      ];
    }

    if (t.isTSConstructSignatureDeclaration(member)) {
      return [
        {
          kind: "construct-signature",
          typeParams: typeParamsFromNode(member),
          params: paramsToParameters(
            member.parameters as t.FunctionParameter[],
          ),
          returnType: memberReturnType(member.typeAnnotation),
        },
      ];
    }

    return [];
  });
}

export function paramsToParameters(params: t.FunctionParameter[]): Parameter[] {
  return params.map((param): Parameter => {
    if (t.isIdentifier(param)) {
      return {
        kind: "param",
        name: param.name,
        type: typeAnnotationFromNode(param),
        optional: param.optional ?? undefined,
      };
    }
    if (t.isAssignmentPattern(param)) {
      const name = t.isIdentifier(param.left)
        ? param.left.name
        : generate(param.left).code;
      const defaultVal = valueFromNode(param.right);
      return {
        kind: "default-param",
        name,
        default: defaultVal ?? {
          kind: "literal",
          value: "undefined",
          type: "any",
        },
        type: typeAnnotationFromNode(param.left as t.Identifier),
      };
    }
    if (t.isRestElement(param)) {
      const name = t.isIdentifier(param.argument)
        ? param.argument.name
        : generate(param.argument).code;
      return {
        kind: "rest-param",
        name,
        type: typeAnnotationFromNode(param),
      };
    }
    if (t.isArrayPattern(param) || t.isObjectPattern(param)) {
      const target = bindingTargetFromPattern(param);
      if (
        target?.kind === "array-destructure" ||
        target?.kind === "object-destructure"
      ) {
        return {
          kind: "destructured-param",
          target: target as ArrayDestructure | ObjectDestructure,
          type: typeAnnotationFromNode(param),
        };
      }
    }
    return { kind: "param", name: generate(param).code };
  });
}
