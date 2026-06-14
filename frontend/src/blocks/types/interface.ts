// --- Interface declaration ---

import type { Parameter, TypeParam } from "./parameter";
import type { PrimitiveType, TypeAnnotation } from "./variable";

export interface InterfaceDeclaration {
  kind: "interface-declaration";
  name: string;
  typeParams: TypeParam[]; // interface Foo<T, U extends string>
  extends: TypeAnnotation[]; // interface Foo extends Bar, Baz  (multiple allowed)
  members: InterfaceMember[];
}

// --- Member kinds ---

export type InterfaceMember =
  | PropertySignature
  | MethodSignature
  | IndexSignature
  | CallSignature
  | ConstructSignature;

// x: string
// x?: string
// readonly x: string

export interface PropertySignature {
  kind: "property-signature";
  name: string;
  optional: boolean;
  readonly: boolean;
  type: TypeAnnotation;
}

// method(a: string, b?: number): void
// method?: (a: string) => void

export interface MethodSignature {
  kind: "method-signature";
  name: string;
  optional: boolean;
  typeParams: TypeParam[]; // method<T>(a: T): T
  params: Parameter[];
  returnType: TypeAnnotation;
}

// [key: string]: unknown
// readonly [index: number]: string

export interface IndexSignature {
  kind: "index-signature";
  keyName: string; // the name "key" or "index" is just a label
  keyType: PrimitiveType; // only string | number | symbol allowed here
  valueType: TypeAnnotation;
  readonly: boolean;
}

// (a: string, b: number): void
// used for interfaces that describe callable objects

export interface CallSignature {
  kind: "call-signature";
  typeParams: TypeParam[];
  params: Parameter[];
  returnType: TypeAnnotation;
}

// new (a: string): Foo
// used for interfaces that describe constructable objects

export interface ConstructSignature {
  kind: "construct-signature";
  typeParams: TypeParam[];
  params: Parameter[];
  returnType: TypeAnnotation;
}
