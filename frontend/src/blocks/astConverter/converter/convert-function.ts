import * as t from "@babel/types";
import { convertBlockBody, convertToIdentifier } from "./convert-value";
import type { FunctionDeclaration } from "../../types/function";
import { convertParameter } from "./convert-paramater";
import { convertType } from "./convert-type";

export function convertFunctionDeclaration(
  func: FunctionDeclaration,
): t.FunctionDeclaration | null {
  const id = convertToIdentifier(func.name);

  const params: t.FunctionParameter[] = func.params.flatMap((param) => {
    const p = convertParameter(param);
    if (p === null) return [];

    return p;
  });

  const functionDeclaration = t.functionDeclaration(
    id,
    params,
    convertBlockBody(func.body),
    func.generator,
    func.async,
  );

  if (func.returnType !== undefined) {
    functionDeclaration.returnType = t.tsTypeAnnotation(
      convertType(func.returnType),
    );
  }

  return functionDeclaration;
}
