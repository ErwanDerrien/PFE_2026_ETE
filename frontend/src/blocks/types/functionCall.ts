// --- Argument (more specific than Value) ---

import type { Value } from "./globalType";
import type { FunctionValue } from "./function";
import type {
  IndexAccess,
  PropertyAccess,
  TemplateString,
  TypeAnnotation,
  VariableRef,
} from "./variable";

export type Argument = Value | SpreadArg;

export interface SpreadArg {
  kind: "spread-arg";
  value: Value; // foo(...args)
}

// --- Regular call ---

export interface Call {
  kind: "call";
  callee: Callee;
  typeArgs: TypeAnnotation[]; // foo<string, number>()
  args: Argument[];
  optional: boolean; // foo?.()
}

// --- What can be called ---

export type Callee =
  | VariableRef // foo()
  | PropertyAccess // obj.method()
  | IndexAccess // obj["method"]()
  | FunctionValue // (() => x)()   IIFE
  | Call; // foo()()       chained call

// --- Constructor call ---

export interface NewCall {
  kind: "new";
  callee: Value;
  typeArgs: TypeAnnotation[]; // new Map<string, number>()
  args: Argument[];
}

// --- Tagged template ---

export interface TaggedTemplate {
  kind: "tagged-template";
  tag: Value; // css`color: red`
  template: TemplateString;
}
