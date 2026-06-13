// --- Declaration kind ---

import type { Value } from "./globalType";

export type DeclarationKind = "const" | "let" | "var";

// --- Binding target (left side of a declarator) ---
// Subset of AssignmentTarget — you can't declare obj.prop or arr[i]

export type BindingTarget =
  | VariableTarget // const x
  | ArrayDestructure // const [a, b]
  | ObjectDestructure; // const { a, b }

// --- Single declarator (one slot in a declaration) ---

export interface VariableDeclarator {
  target: BindingTarget;
  init?: Value; // optional — "let x" has no init
  type?: TypeAnnotation; // optional — TypeScript only
}

// --- TypeScript type annotation (optional, can grow later) ---

export type TypeAnnotation =
  | PrimitiveType
  | LiteralType
  | UnionType
  | IntersectionType
  | ArrayType
  | TupleType
  | ObjectType
  | FunctionType
  | GenericType
  | TypeReference;

export interface PrimitiveType {
  kind: "primitive";
  name:
    | "string"
    | "number"
    | "boolean"
    | "bigint"
    | "symbol"
    | "null"
    | "undefined"
    | "void"
    | "never"
    | "any"
    | "unknown";
}

export interface LiteralType {
  kind: "literal-type";
  value: string | number | boolean; // "foo" | 42 | true as types
}

export interface UnionType {
  kind: "union";
  members: TypeAnnotation[]; // string | number
}

export interface IntersectionType {
  kind: "intersection";
  members: TypeAnnotation[]; // A & B
}

export interface ArrayType {
  kind: "array";
  element: TypeAnnotation; // string[]
}

export interface TupleType {
  kind: "tuple";
  elements: TypeAnnotation[]; // [string, number]
}

export interface ObjectType {
  kind: "object";
  properties: { key: string; value: TypeAnnotation; optional: boolean }[];
}

export interface FunctionType {
  kind: "function";
  params: { name: string; type: TypeAnnotation }[];
  returns: TypeAnnotation;
}

export interface GenericType {
  kind: "generic";
  base: TypeAnnotation;
  args: TypeAnnotation[]; // Map<string, number>
}

export interface TypeReference {
  kind: "type-reference";
  name: string; // refers to a named type: MyType, T
}

// --- The declaration itself ---

export interface VariableDeclaration {
  kind: "variable-declaration";
  declarationKind: DeclarationKind;
  declarations: VariableDeclarator[]; // const a = 1, b = 2  →  two declarators
}

// --- Operator ---

export type AssignmentOperator =
  | "="
  | "+="
  | "-="
  | "*="
  | "/="
  | "%="
  | "**="
  | "&="
  | "|="
  | "^="
  | "<<="
  | ">>="
  | ">>>="
  | "&&="
  | "||="
  | "??=";

// --- Assignment target (left side) ---

export type AssignmentTarget =
  | VariableTarget // x = ...
  | PropertyTarget // obj.prop = ...
  | IndexTarget // arr[0] = ...
  | ArrayDestructure // [a, b] = ...
  | ObjectDestructure; // { a, b } = ...

export interface VariableTarget {
  kind: "variable";
  name: string;
}

export interface PropertyTarget {
  kind: "property";
  object: Value;
  property: string; // obj.prop
}

export interface IndexTarget {
  kind: "index";
  object: Value;
  index: Value; // arr[expr]
}

export interface ArrayDestructure {
  kind: "array-destructure";
  elements: (AssignmentTarget | DefaultedTarget | Rest | null)[];
  //         ^item              ^item = default   ^...x   ^hole
}

export interface ObjectDestructure {
  kind: "object-destructure";
  properties: (DestructuredProp | Rest)[];
}

export interface DestructuredProp {
  key: string; // source key
  alias?: string; // { x: y }  →  key="x", alias="y"
  default?: Value; // { x = 5 }
  nested?: AssignmentTarget; // { x: { a, b } }
}

export interface DefaultedTarget {
  kind: "defaulted";
  target: AssignmentTarget;
  default: Value; // [a = 0] in array destructure
}

export interface Rest {
  kind: "rest";
  target: AssignmentTarget; // ...rest
}

export interface Literal {
  kind: "literal";
  value: string;
}

export interface VariableRef {
  kind: "variable";
  name: string;
}

export interface PropertyAccess {
  kind: "property";
  object: Value;
  property: string;
  optional: boolean; // obj?.prop
}

export interface IndexAccess {
  kind: "index";
  object: Value;
  index: Value;
  optional: boolean; // arr?.[i]
}

export interface Call {
  kind: "call";
  callee: Value;
  args: Value[];
  optional: boolean; // fn?.()
}

export interface BinaryOp {
  kind: "binary";
  op: string; // "+", "===", "instanceof", ...
  left: Value;
  right: Value;
}

export interface UnaryOp {
  kind: "unary";
  op: string; // "!", "typeof", "-", ...
  value: Value;
}

export interface Ternary {
  kind: "ternary";
  condition: Value;
  then: Value;
  else: Value;
}

export interface FunctionValue {
  kind: "function";
  params: string[];
  arrow: boolean;
}

export interface ArrayValue {
  kind: "array";
  elements: (Value | Spread | null)[];
}

export interface ObjectValue {
  kind: "object";
  properties: { key: string; value: Value }[];
}

export interface TemplateString {
  kind: "template";
  parts: (string | Value)[]; // alternating static strings and expressions
}

export interface Await {
  kind: "await";
  value: Value;
}

export interface Yield {
  kind: "yield";
  value: Value | null;
  delegate: boolean; // yield*
}

export interface Spread {
  kind: "spread";
  value: Value;
}

export interface AssignmentExpression {
  kind: "assignment";
  operator: AssignmentOperator;
  assignmentTargetName: AssignmentTarget;
  assignmentTargetValue: Value;
}
