import type {
  ArrayDestructure,
  PropertyTarget,
  VariableDeclaration,
  VariableDeclarator,
  VariableTarget,
} from "../../types/variable";
import * as t from "@babel/types";
import { convertAssignmentTarget, convertNodeFromValue } from "./convert-value";
import { convertType } from "./convert-type";

// export type BindingTarget =
//   | VariableTarget // const x
//   | ArrayDestructure // const [a, b]
//   | ObjectDestructure; // const { a, b }

export const convertVariable = (
  variable: VariableDeclaration,
): t.VariableDeclaration => {
  const declarators: t.VariableDeclarator[] = variable.declarations.flatMap(
    (declarator) => {
      const target = convertAssignmentTarget(declarator.target);

      if (target == null) return [];

      if (target.type === "Identifier" && declarator.type) {
        target.typeAnnotation = t.tsTypeAnnotation(
          convertType(declarator.type),
        );
      }

      const init = declarator.init
        ? convertNodeFromValue(declarator.init)
        : null;
      return t.variableDeclarator(target, init);
    },
  );

  return t.variableDeclaration(variable.declarationKind, declarators);
};

// convertVariableArrayDestructure = (variable: ArrayDestructure): t.ArrayPattern =>  {

// }
// export type AssignmentTarget =
//   | VariableTarget // x = ...
//   | PropertyTarget // obj.prop = ...
//   | IndexTarget // arr[0] = ...
//   | ArrayDestructure // [a, b] = ...
//   | ObjectDestructure; // { a, b } = ...
