import type { Statement, Value } from "./globalType";
import type { Parameter, TypeParam } from "./parameter";
import type { TypeAnnotation } from "./variable";

export interface FunctionDeclaration {
  kind: "function-declaration";
  name: string; // required — declarations always have a name
  typeParams: TypeParam[]; // function foo<T, U>()
  params: Parameter[];
  returnType?: TypeAnnotation;
  async: boolean;
  generator: boolean; // function* gen()
  body: Block; // always a block for declarations
}

// --- Updated FunctionValue (expression form) ---
// Replaces the bare version from before

export interface FunctionValue {
  kind: "function";
  name?: string; // named fn expression: const x = function foo() {}
  typeParams: TypeParam[];
  params: Parameter[];
  returnType?: TypeAnnotation;
  async: boolean;
  generator: boolean;
  arrow: boolean; // distinguishes => from function keyword
  body: Block | Value; // Value only for arrow shorthand: x => x + 1
}

// --- Updated Block ---
// Can contain any statement, including nested function declarations

interface Block {
  kind: "block";
  content: Statement[];
}
