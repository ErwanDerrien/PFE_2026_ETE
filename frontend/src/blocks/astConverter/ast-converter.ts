import * as t from "@babel/types";
import type { FunctionDeclaration, FunctionValue } from "../types/function";
import { convertFunctionDeclaration } from "./converter/convert-function";
import { convertBlockBody } from "./converter/convert-value";

export const convertObjectToAst = (
  func: FunctionDeclaration | FunctionValue,
): t.File => {
  if (func.kind === "function-declaration") {
    if (func.name === "<global>") {
      const block = convertBlockBody(func.body);
      return t.file(t.program(block.body));
    }

    const funcDeclaration = convertFunctionDeclaration(func);
    if (funcDeclaration !== null) return t.file(t.program([funcDeclaration]));
  }
  return t.file(t.program([]));
};
