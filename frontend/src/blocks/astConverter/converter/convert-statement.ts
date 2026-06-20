import * as t from "@babel/types";
import type { AssignmentExpression } from "../../types/variable";
import { convertAssignmentTarget, convertNodeFromValue } from "./convert-value";
export const assignmentExpression = (
  expression: AssignmentExpression,
): t.AssignmentExpression => {
  const left = convertAssignmentTarget(expression.assignmentTargetName);
  if (left === null) {
    throw new Error("Invalid assignment target");
  }

  const right = convertNodeFromValue(expression.assignmentTargetValue);

  if (right === null) {
    throw new Error("Invalid assignment value");
  }

  return t.assignmentExpression(expression.operator, left, right);
};
