import * as t from "@babel/types";
import type { AssignmentExpression } from "../../types/variable";
import {
  convertAssignmentTarget,
  convertBlockBody,
  convertNodeFromValue,
} from "./convert-value";
import type { IfStatement } from "../../types/ifStatement";
import type { ReturnStatement } from "../../types/returnStatement";

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
