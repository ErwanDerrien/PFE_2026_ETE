import type {
  LiteralType,
  PrimitiveType,
  TypeAnnotation,
  TypeParam,
} from "../../types/variable";
import * as t from "@babel/types";
import { convertToIdentifier } from "./convert-value";

export const convertType = (type: TypeAnnotation): t.TSType => {
  if (type.kind === "primitive") {
    return convertPrimitiveType(type);
  }

  if (type.kind === "literal-type") {
    return convertLiteralType(type);
  }

  if (type.kind === "union") {
    const types = type.members.map((t) => convertType(t));
    return t.tSUnionType(types);
  }

  if (type.kind === "intersection") {
    const types = type.members.map((t) => convertType(t));
    return t.tSIntersectionType(types);
  }

  if (type.kind === "array") {
    const elementType = convertType(type.element);
    return t.tsArrayType(elementType);
  }

  if (type.kind === "tuple") {
    const elementTypes = type.elements.map((t) => convertType(t));
    return t.tsTupleType(elementTypes);
  }

  if (type.kind === "object") {
    const properties = type.properties.map((p) => {
      const key = convertToIdentifier(p.key);
      const value = convertType(p.value);
      return t.tsPropertySignature(key, t.tsTypeAnnotation(value));
    });

    return t.tsTypeLiteral(properties);
  }

  if (type.kind === "function") {
    const typeParams = type.typeParams?.length
      ? t.tsTypeParameterDeclaration(convertTypeParams(type.typeParams))
      : null;
    const params = type.params.map((p) => {
      const identifier = t.identifier(p.name);
      identifier.typeAnnotation = t.tsTypeAnnotation(convertType(p.type));
      return identifier;
    });
    const returnType = t.tsTypeAnnotation(convertType(type.returns));
    return t.tsFunctionType(typeParams, params, returnType);
  }

  if (type.kind === "type-reference") {
    return t.tsTypeReference(t.identifier(type.name));
  }

  if (type.kind === "generic") {
    if (type.base.kind !== "type-reference") {
      throw new Error("Generic base must be a type reference");
    }
    const typeArgs = type.args.map((a) => convertType(a));
    return t.tsTypeReference(
      t.identifier(type.base.name),
      t.tsTypeParameterInstantiation(typeArgs),
    );
  }
  console.log(type);
  throw new Error("Unsupported type");
};

export const convertLiteralType = (type: LiteralType): t.TSLiteralType => {
  if (typeof type.value === "string") {
    return t.tsLiteralType(t.stringLiteral(type.value));
  }

  if (typeof type.value === "boolean") {
    return t.tsLiteralType(t.booleanLiteral(type.value));
  }

  if (typeof type.value === "number") {
    return t.tsLiteralType(t.numericLiteral(type.value));
  }

  throw new Error("Unsupported literal type");
};

export const convertTypeParams = (
  typeParams: TypeParam[],
): t.TSTypeParameter[] =>
  typeParams.map((tp) =>
    t.tsTypeParameter(
      tp.constraint ? convertType(tp.constraint) : null,
      tp.default ? convertType(tp.default) : null,
      tp.name,
    ),
  );

export const convertPrimitiveType = (type: PrimitiveType): t.TSType => {
  switch (type.name) {
    case "string":
      return t.tsStringKeyword();
    case "number":
      return t.tsNumberKeyword();
    case "boolean":
      return t.tsBooleanKeyword();
    case "bigint":
      return t.tsBigIntKeyword();
    case "symbol":
      return t.tsSymbolKeyword();
    case "null":
      return t.tsNullKeyword();
    case "undefined":
      return t.tsUndefinedKeyword();
    case "void":
      return t.tsVoidKeyword();
    default:
      throw new Error(`Unsupported primitive type: ${type.name}`);
  }
};
