import type { Call } from "../../types/functionCall";
import type { Block, Value } from "../../types/globalType";
import {
  type ArrayDestructure,
  type ArrayValue,
  type AssignmentExpression,
  type AssignmentTarget,
  type Await,
  type BinaryOp,
  type IndexAccess,
  type Literal,
  type ObjectDestructure,
  type ObjectValue,
  type PropertyAccess,
  type Ternary,
  type UnaryOp,
  type Yield,
} from "../../types/variable";
import * as t from "@babel/types";
import { convertVariable } from "./convert-variables";

const UNARY_OPERATORS = [
  "!",
  "-",
  "+",
  "typeof",
  "void",
  "delete",
  "~",
] as const;

const UPDATE_OPERATORS = ["++", "--"] as const;

type UpdateOperator = (typeof UPDATE_OPERATORS)[number];

function isUpdateOperator(op: string): op is UpdateOperator {
  return (UPDATE_OPERATORS as readonly string[]).includes(op);
}

type UnaryOperator = (typeof UNARY_OPERATORS)[number];

const LOGICAL_OPERATORS = ["||", "&&", "??"] as const;
type LogicalOperator = (typeof LOGICAL_OPERATORS)[number];

function isLogicalOperator(op: string): op is LogicalOperator {
  return (LOGICAL_OPERATORS as readonly string[]).includes(op);
}

function isUnaryOperator(op: string): op is UnaryOperator {
  return (UNARY_OPERATORS as readonly string[]).includes(op);
}

export const convertBlockBody = (block: Block): t.BlockStatement => {
  const body = block.content.flatMap((statement) => {
    if (statement.kind === "variable-declaration") {
      return convertVariable(statement);
    }

    return [];
  });
  return t.blockStatement(body);
};

export const convertNodeFromValue = (val: Value): t.Expression | null => {
  if (!val) return null;

  if (val.kind === "literal") {
    return convertLiterals(val);
  }

  if (val.kind === "variable") {
    return convertToIdentifier(val.name);
  }

  if (val.kind === "property" || val.kind === "index") {
    return convertToMemberNode(val);
  }

  if (val.kind === "call") {
    return convertCallExpression(val);
  }

  if (val.kind === "binary") {
    return convertBinaryOp(val);
  }

  if (val.kind === "unary") {
    return convertUnaryOp(val);
  }

  if (val.kind === "ternary") {
    return convertTernary(val);
  }

  if (val.kind === "array") {
    return convertArrayValue(val);
  }

  if (val.kind === "object") {
    return convertObjectValue(val);
  }

  if (val.kind === "await") {
    return convertAwait(val);
  }

  if (val.kind === "yield") {
    return convertYield(val);
  }

  if (val.kind === "assignment") {
    return convertAssignmentExpression(val);
  }

  return null;
};

const convertToMemberNode = (
  value: PropertyAccess | IndexAccess,
): t.MemberExpression | null => {
  const obj = convertNodeFromValue(value.object);
  if (!obj) return null;

  const property =
    value.kind === "property"
      ? convertToIdentifier(value.property)
      : convertNodeFromValue(value.index);

  if (!property) return null;

  const computed = value.kind === "index";
  return t.memberExpression(obj, property, computed, value.optional);
};

const convertCallExpression = (val: Call): t.CallExpression | null => {
  const callee = convertNodeFromValue(val.callee);
  if (!callee) return null;

  const args: (t.Expression | t.SpreadElement)[] = [];

  val.args.forEach((arg) => {
    if (arg.kind === "spread-arg") {
      const res = convertNodeFromValue(arg.value);
      if (res !== null) {
        args.push(t.spreadElement(res));
      }
      return;
    }

    const res = convertNodeFromValue(arg);
    if (res !== null) {
      args.push(res);
    }
  });

  return t.callExpression(callee, args);
};

const convertBinaryOp = (
  val: BinaryOp,
): t.BinaryExpression | t.LogicalExpression | null => {
  const left = convertNodeFromValue(val.left);
  const right = convertNodeFromValue(val.right);

  if (left === null || right === null) return null;

  if (isLogicalOperator(val.op)) {
    return t.logicalExpression(val.op, left, right);
  }

  return t.binaryExpression(
    val.op as t.BinaryExpression["operator"],
    left,
    right,
  );
};

const convertUnaryOp = (
  val: UnaryOp,
): t.UnaryExpression | t.UpdateExpression | null => {
  const argument = convertNodeFromValue(val.value);

  if (argument === null) return null;
  if (isUpdateOperator(val.op)) {
    return t.updateExpression(val.op, argument);
  }

  if (isUnaryOperator(val.op)) {
    return t.unaryExpression(val.op, argument);
  }

  return null;
};

const convertTernary = (val: Ternary): t.ConditionalExpression | null => {
  const test = convertNodeFromValue(val.condition);
  const consequent = convertNodeFromValue(val.then);
  const alternate = convertNodeFromValue(val.else);
  if (test === null || consequent === null || alternate === null) return null;
  return t.conditionalExpression(test, consequent, alternate);
};

// const convertFunctionValue = (val: FunctionValue): t.FunctionExpression | null => {
//     return t.functionExpression
// };

export function convertArrayPattern(val: ArrayDestructure): t.ArrayPattern {
  const elements = val.elements.map((el): t.PatternLike | null => {
    if (el === null) return null;
    if (el.kind === "rest") {
      const target = convertAssignmentTarget(el.target);
      return target ? t.restElement(target as any) : null;
    }
    if (el.kind === "defaulted") {
      const target = convertAssignmentTarget(el.target);
      const def = convertNodeFromValue(el.default);
      if (!target || !def) return null;
      return t.assignmentPattern(target as any, def);
    }
    return convertAssignmentTarget(el) as t.PatternLike | null;
  });
  return t.arrayPattern(elements);
}

export function convertObjectPattern(val: ObjectDestructure): t.ObjectPattern {
  const properties: (t.ObjectProperty | t.RestElement)[] = [];
  for (const prop of val.properties) {
    if (prop.kind === "rest") {
      const target = convertAssignmentTarget(prop.target);
      if (target) properties.push(t.restElement(target as any));
      continue;
    }
    const key = objectKeyNode(prop.key);
    if (prop.nested) {
      const nested = convertAssignmentTarget(prop.nested);
      if (!nested) continue;
      properties.push(t.objectProperty(key, nested as t.Expression));
    } else if (prop.alias && prop.default) {
      const def = convertNodeFromValue(prop.default);
      if (!def) continue;
      properties.push(
        t.objectProperty(
          key,
          t.assignmentPattern(t.identifier(prop.alias), def),
        ),
      );
    } else if (prop.alias) {
      properties.push(t.objectProperty(key, t.identifier(prop.alias)));
    } else if (prop.default) {
      const def = convertNodeFromValue(prop.default);
      if (!def) continue;
      properties.push(
        t.objectProperty(key, t.assignmentPattern(t.identifier(prop.key), def)),
      );
    } else {
      // shorthand: { x }
      properties.push(
        t.objectProperty(key, t.identifier(prop.key), false, true),
      );
    }
  }
  return t.objectPattern(properties);
}

const convertAssignmentExpression = (
  val: AssignmentExpression,
): t.AssignmentExpression | null => {
  const left = convertAssignmentTarget(val.assignmentTargetName);
  const right = convertNodeFromValue(val.assignmentTargetValue);
  if (left === null || right === null) return null;
  return t.assignmentExpression(val.operator, left, right);
};

export const convertAssignmentTarget = (
  val: AssignmentTarget,
):
  | t.Identifier
  | t.MemberExpression
  | t.ArrayPattern
  | t.ObjectPattern
  | null => {
  if (val.kind === "variable") {
    return t.identifier(val.name);
  }

  if (val.kind === "property") {
    const obj = convertNodeFromValue(val.object);
    if (!obj) return null;
    return t.memberExpression(obj, convertToIdentifier(val.property), false);
  }

  if (val.kind === "index") {
    const obj = convertNodeFromValue(val.object);
    const index = convertNodeFromValue(val.index);
    if (!obj || !index) return null;
    return t.memberExpression(obj, index, true);
  }

  if (val.kind === "array-destructure") return convertArrayPattern(val);
  if (val.kind === "object-destructure") return convertObjectPattern(val);

  return null;
};

const convertArrayValue = (val: ArrayValue): t.ArrayExpression | null => {
  const elements: (t.Expression | t.SpreadElement | null)[] = [];
  val.elements.forEach((el) => {
    if (el === null) {
      elements.push(null);
      return;
    }

    if (el.kind === "spread") {
      const res = convertNodeFromValue(el.value);
      if (res !== null) {
        elements.push(t.spreadElement(res));
      }
      return;
    }

    const res = convertNodeFromValue(el);
    if (res !== null) {
      elements.push(res);
    }
  });
  return t.arrayExpression(elements as t.Expression[]);
};

function objectKeyNode(
  key: string,
): t.Identifier | t.StringLiteral | t.NumericLiteral {
  if (/^\d+(\.\d+)?$/.test(key)) return t.numericLiteral(Number(key));
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) return t.identifier(key);
  return t.stringLiteral(key);
}

const convertObjectValue = (val: ObjectValue): t.ObjectExpression => {
  const properties: t.ObjectProperty[] = [];
  val.properties.forEach((prop) => {
    if (prop === null) return;
    const key = objectKeyNode(prop.key);
    const value = convertNodeFromValue(prop.value);
    if (value !== null) {
      properties.push(t.objectProperty(key, value));
    }
  });
  return t.objectExpression(properties);
};

const convertAwait = (val: Await): t.AwaitExpression | null => {
  const argument = convertNodeFromValue(val.value);
  if (argument !== null) {
    return t.awaitExpression(argument);
  }
  return null;
};

const convertYield = (val: Yield): t.YieldExpression | null => {
  const argument = val.value ? convertNodeFromValue(val.value) : null;

  return t.yieldExpression(argument, val.delegate);
};

const convertStringLiteral = (value: Literal): t.StringLiteral => {
  return t.stringLiteral(value.value as string);
};

const convertNumberLiteral = (value: Literal): t.NumericLiteral => {
  return t.numericLiteral(value.value as number);
};

const convertBooleanLiteral = (value: Literal): t.BooleanLiteral => {
  return t.booleanLiteral(value.value as boolean);
};

const convertNullLiteral = (): t.NullLiteral => {
  return t.nullLiteral();
};

const convertBigIntLiteral = (value: Literal): t.BigIntLiteral => {
  const str = value.value as string;
  const raw = str.endsWith("n") ? str.slice(0, -1) : str;
  return { type: "BigIntLiteral", value: raw } as t.BigIntLiteral;
};

const convertRegExpLiteral = (value: Literal): t.RegExpLiteral => {
  const str = value.value as string; // e.g. "/foo/gi"
  const lastSlash = str.lastIndexOf("/");
  return t.regExpLiteral(str.slice(1, lastSlash), str.slice(lastSlash + 1));
};

export const convertToIdentifier = (value: string): t.Identifier => {
  return t.identifier(value);
};

const convertLiterals = (value: Literal): t.Literal => {
  const recordLiterals: Record<string, (value: Literal) => t.Literal> = {
    string: convertStringLiteral,
    number: convertNumberLiteral,
    boolean: convertBooleanLiteral,
    null: convertNullLiteral,
    bigint: convertBigIntLiteral,
    regexp: convertRegExpLiteral,
  };

  return recordLiterals[value.type](value);
};
