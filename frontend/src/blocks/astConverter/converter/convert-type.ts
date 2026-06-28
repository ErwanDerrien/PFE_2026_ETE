import type {
  LiteralType,
  PrimitiveType,
  TypeAnnotation,
  TypeParam,
} from "../../types/variable";
import * as t from "@babel/types";
import { convertToIdentifier, objectKeyNode } from "./convert-value";
import { convertParameter } from "./convert-paramater";

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
    case "any":
      return t.tsAnyKeyword();
    case "unknown":
      return t.tsUnknownKeyword();
    default:
      throw new Error(`Unsupported primitive type: ${type.name}`);
  }
};

type SignatureParam =
  | t.Identifier
  | t.RestElement
  | t.ObjectPattern
  | t.ArrayPattern;

const convertSignatureParams = (
  params: import("../../types/parameter").Parameter[],
): SignatureParam[] =>
  params.flatMap((p) => {
    const res = convertParameter(p);
    if (
      !res ||
      (!t.isIdentifier(res) &&
        !t.isRestElement(res) &&
        !t.isObjectPattern(res) &&
        !t.isArrayPattern(res))
    )
      return [];
    return [res as SignatureParam];
  });

export const convertPropertySignature = (
  member: import("../../types/interface").PropertySignature,
): t.TSPropertySignature => {
  const prop = t.tsPropertySignature(
    t.identifier(member.name),
    t.tsTypeAnnotation(convertType(member.type)),
  );
  prop.optional = member.optional;
  prop.readonly = member.readonly;
  return prop;
};

export const convertMethodSignature = (
  member: import("../../types/interface").MethodSignature,
): t.TSMethodSignature => {
  const typeParams =
    member.typeParams.length > 0
      ? t.tsTypeParameterDeclaration(convertTypeParams(member.typeParams))
      : null;
  const method = t.tsMethodSignature(
    objectKeyNode(member.name),
    typeParams,
    convertSignatureParams(member.params),
    t.tsTypeAnnotation(convertType(member.returnType)),
  );
  method.optional = member.optional;
  return method;
};

export const convertIndexSignature = (
  member: import("../../types/interface").IndexSignature,
): t.TSIndexSignature => {
  const keyParam = t.identifier(member.keyName);
  keyParam.typeAnnotation = t.tsTypeAnnotation(convertType(member.keyType));
  const sig = t.tsIndexSignature(
    [keyParam],
    t.tsTypeAnnotation(convertType(member.valueType)),
  );
  sig.readonly = member.readonly;
  return sig;
};

export const convertCallSignature = (
  member: import("../../types/interface").CallSignature,
): t.TSCallSignatureDeclaration => {
  const typeParams =
    member.typeParams.length > 0
      ? t.tsTypeParameterDeclaration(convertTypeParams(member.typeParams))
      : null;
  return t.tsCallSignatureDeclaration(
    typeParams,
    convertSignatureParams(member.params),
    t.tsTypeAnnotation(convertType(member.returnType)),
  );
};

export const convertConstructSignature = (
  member: import("../../types/interface").ConstructSignature,
): t.TSConstructSignatureDeclaration => {
  const typeParams =
    member.typeParams.length > 0
      ? t.tsTypeParameterDeclaration(convertTypeParams(member.typeParams))
      : null;
  return t.tsConstructSignatureDeclaration(
    typeParams,
    convertSignatureParams(member.params),
    t.tsTypeAnnotation(convertType(member.returnType)),
  );
};

export const convertExtendsClause = (
  ext: import("../../types/variable").TypeAnnotation,
): t.TSExpressionWithTypeArguments => {
  if (ext.kind === "type-reference") {
    return t.tsExpressionWithTypeArguments(t.identifier(ext.name));
  }
  if (ext.kind === "generic" && ext.base.kind === "type-reference") {
    return t.tsExpressionWithTypeArguments(
      t.identifier(ext.base.name),
      t.tsTypeParameterInstantiation(ext.args.map((a) => convertType(a))),
    );
  }
  throw new Error("Interface extends must be a type reference or generic");
};
