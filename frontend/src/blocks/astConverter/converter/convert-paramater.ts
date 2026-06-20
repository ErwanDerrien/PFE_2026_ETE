import type { Parameter } from "../../types/parameter";
import * as t from "@babel/types";
import {
  convertArrayPattern,
  convertNodeFromValue,
  convertObjectPattern,
} from "./convert-value";
import { convertType } from "./convert-type";

export const convertParameter = (
  param: Parameter,
): t.FunctionParameter | null => {
  console.log("convertParameter", param);
  switch (param.kind) {
    case "param":
      return convertSimpleParameter(param);
    case "default-param":
      return convertDefaultParameter(param);
    case "destructured-param":
      return convertDestructuredParameter(param);
    case "rest-param":
      return convertRestParameter(param);
  }
};

export const convertSimpleParameter = (param: Parameter): t.Identifier => {
  if (param.kind !== "param") {
    throw new Error("Expected a simple parameter");
  }
  const id = t.identifier(param.name);
  if (param.type) {
    id.typeAnnotation = t.tsTypeAnnotation(convertType(param.type));
  }

  return id;
};

export const convertDefaultParameter = (
  param: Parameter,
): t.AssignmentPattern | null => {
  if (param.kind !== "default-param") {
    throw new Error("Expected a default parameter");
  }
  const defaultValue = convertNodeFromValue(param.default);

  if (!defaultValue) return null;
  return t.assignmentPattern(convertSimpleParameter(param), defaultValue);
};

export const convertDestructuredParameter = (
  param: Parameter,
): t.ObjectPattern | t.ArrayPattern | null => {
  if (param.kind !== "destructured-param") {
    throw new Error("Expected a destructured parameter");
  }

  if (param.target.kind === "array-destructure") {
    return convertArrayPattern(param.target);
  }

  if (param.target.kind === "object-destructure") {
    return convertObjectPattern(param.target);
  }

  return null;
};

export const convertRestParameter = (
  param: Parameter,
): t.RestElement | null => {
  if (param.kind !== "rest-param") {
    throw new Error("Expected a rest parameter");
  }
  return t.restElement(convertSimpleParameter(param));
};
