import * as t from "@babel/types";
import { convertBlockBody, convertToIdentifier } from "./convert-value";
import type { FunctionDeclaration } from "../../types/function";
import { convertParameter } from "./convert-paramater";

export function convertFunctionDeclaration(
  func: FunctionDeclaration,
): t.FunctionDeclaration | null {
  const id = convertToIdentifier(func.name);
  const params: t.FunctionParameter[] = func.params.flatMap((param) => {
    const p = convertParameter(param);
    if (p === null) return [];

    return p;
  });
  return t.functionDeclaration(
    id,
    params,
    convertBlockBody(func.body),
    func.generator,
    func.async,
  );
}
