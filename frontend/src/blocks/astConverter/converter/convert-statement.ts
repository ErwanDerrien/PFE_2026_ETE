import * as t from "@babel/types";
import type { AssignmentExpression } from "../../types/variable";
import {
  convertAssignmentTarget,
  convertBlockBody,
  convertNodeFromValue,
  getStatement,
} from "./convert-value";
import type { IfStatement } from "../../types/ifStatement";
import type { ReturnStatement } from "../../types/returnStatement";
import type { SwitchStatement } from "../../types/switch-case";
import type {
  DoWhileStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  WhileStatement,
} from "../../types/loops";
import type { InterfaceDeclaration } from "../../types/interface";
import {
  convertCallSignature,
  convertConstructSignature,
  convertExtendsClause,
  convertIndexSignature,
  convertMethodSignature,
  convertPropertySignature,
  convertTypeParams,
} from "./convert-type";
import { convertVariable } from "./convert-variables";

export const convertExpressionStatement = (
  expression: AssignmentExpression,
): t.ExpressionStatement => {
  const left = convertAssignmentTarget(expression.assignmentTargetName);
  if (left === null) {
    throw new Error("Invalid assignment target");
  }

  const right = convertNodeFromValue(expression.assignmentTargetValue);

  if (right === null) {
    throw new Error("Invalid assignment value");
  }

  return t.expressionStatement(
    t.assignmentExpression(expression.operator, left, right),
  );
};

export const convertIfStatement = (statement: IfStatement): t.IfStatement => {
  const test = convertNodeFromValue(statement.condition);
  if (test === null) {
    throw new Error("Invalid if statement test");
  }
  const ifStatement = t.ifStatement(test, convertBlockBody(statement.then));

  if (statement.else !== undefined) {
    if (statement.else.kind === "if") {
      ifStatement.alternate = convertIfStatement(statement.else);
    } else {
      ifStatement.alternate = convertBlockBody(statement.else);
    }
  }
  return ifStatement;
};

export const convertReturnStatement = (
  statement: ReturnStatement,
): t.ReturnStatement => {
  const argument = convertNodeFromValue(statement.value);
  return t.returnStatement(argument);
};

export const convertSwitchStatement = (
  statement: SwitchStatement,
): t.SwitchStatement => {
  const discriminant = convertNodeFromValue(statement.discriminant);
  if (discriminant === null) {
    throw new Error("Invalid switch statement discriminant");
  }
  const cases = statement.cases.map((c) => {
    if (c.kind === "case") {
      const test = convertNodeFromValue(c.test);
      const consequent = c.body.flatMap((s) => {
        const res = getStatement(s);

        if (res === null) {
          return [];
        }
        return res;
      });
      return t.switchCase(test, consequent);
    } else {
      const consequent = c.body.flatMap((s) => {
        const res = getStatement(s);
        if (res === null) {
          return [];
        }
        return res;
      });
      return t.switchCase(null, consequent);
    }
  });
  return t.switchStatement(discriminant, cases);
};

export const convertBreakStatement = (
  statement: t.BreakStatement,
): t.BreakStatement => {
  return t.breakStatement(statement.label);
};

export const convertContinueStatement = (
  statement: t.ContinueStatement,
): t.ContinueStatement => {
  return t.continueStatement(statement.label);
};

export const convertWhileStatement = (
  statement: WhileStatement,
): t.WhileStatement => {
  const test = convertNodeFromValue(statement.condition);

  if (test === null) {
    throw new Error("Invalid while statement condition");
  }

  const body = convertBlockBody(statement.body);
  return t.whileStatement(test, body);
};

export const convertDoWhileStatement = (
  statement: DoWhileStatement,
): t.DoWhileStatement => {
  const test = convertNodeFromValue(statement.condition);
  if (test === null) {
    throw new Error("Invalid do-while statement condition");
  }
  const body = convertBlockBody(statement.body);
  return t.doWhileStatement(test, body);
};

export const convertInterfaceDeclaration = (
  interfaceDeclaration: InterfaceDeclaration,
): t.TSInterfaceDeclaration => {
  const id = t.identifier(interfaceDeclaration.name);

  const typeParameters =
    interfaceDeclaration.typeParams.length > 0
      ? t.tsTypeParameterDeclaration(
          convertTypeParams(interfaceDeclaration.typeParams),
        )
      : null;

  const extendsClause = interfaceDeclaration.extends.map(convertExtendsClause);

  const members: t.TSTypeElement[] = interfaceDeclaration.members.flatMap(
    (member): t.TSTypeElement[] => {
      if (member.kind === "property-signature")
        return [convertPropertySignature(member)];
      if (member.kind === "method-signature")
        return [convertMethodSignature(member)];
      if (member.kind === "index-signature")
        return [convertIndexSignature(member)];
      if (member.kind === "call-signature")
        return [convertCallSignature(member)];
      if (member.kind === "construct-signature")
        return [convertConstructSignature(member)];
      return [];
    },
  );

  return t.tsInterfaceDeclaration(
    id,
    typeParameters,
    extendsClause,
    t.tsInterfaceBody(members),
  );
};

export const convertForStatement = (
  forStatement: ForStatement,
): t.ForStatement => {
  let init = null;
  if (forStatement.init?.kind === "variable-declaration") {
    init = convertVariable(forStatement.init);
  } else if (forStatement.init) {
    init = convertNodeFromValue(forStatement.init);
  }

  const test = forStatement.test
    ? convertNodeFromValue(forStatement.test)
    : null;
  const update = forStatement.update
    ? convertNodeFromValue(forStatement.update)
    : null;
  const body = convertBlockBody(forStatement.body);

  return t.forStatement(init, test, update, body);
};

export const convertForInStatement = (
  forInStatement: ForInStatement,
): t.ForInStatement => {
  let left;
  if (forInStatement.left.kind === "variable-declaration") {
    left = convertVariable(forInStatement.left);
  } else {
    left = convertAssignmentTarget(forInStatement.left);
  }
  if (left == null) throw new Error("left is null");

  const right = convertNodeFromValue(forInStatement.right);

  if (right == null) throw new Error("right is null");

  const body = convertBlockBody(forInStatement.body);
  return t.forInStatement(left, right, body);
};

export const convertForOfStatement = (
  forOfStatement: ForOfStatement,
): t.ForOfStatement => {
  let left;
  if (forOfStatement.left.kind === "variable-declaration") {
    left = convertVariable(forOfStatement.left);
  } else {
    left = convertAssignmentTarget(forOfStatement.left);
  }
  if (left == null) throw new Error("left is null");
  const right = convertNodeFromValue(forOfStatement.right);
  if (right == null) throw new Error("right is null");
  const body = convertBlockBody(forOfStatement.body);
  return t.forOfStatement(left, right, body);
};
