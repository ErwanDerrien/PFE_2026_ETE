import type { Block, Value } from "./globalType";
import type { AssignmentTarget, VariableDeclaration } from "./variable";

// --- while (cond) { } ---

export interface WhileStatement {
  uid?: number;
  kind: "while";
  condition: Value;
  body: Block;
}

// --- do { } while (cond) ---

export interface DoWhileStatement {
  uid?: number;
  kind: "do-while";
  condition: Value;
  body: Block;
}

// --- for (init; test; update) { } ---

export interface ForStatement {
  uid?: number;
  kind: "for";
  init?: VariableDeclaration | Value; // let i = 0  |  i = 0  |  (omitted)
  test?: Value; // i < n  |  (omitted → for(;;) )
  update?: Value; // i++  →  unary (handled by valueFromNode)
  body: Block;
}

// --- for (k in obj) { } ---

export interface ForInStatement {
  uid?: number;
  kind: "for-in";
  left: VariableDeclaration | AssignmentTarget; // const k  |  existing var
  right: Value;
  body: Block;
}

// --- for (x of arr) { }  /  for await (x of arr) { } ---

export interface ForOfStatement {
  uid?: number;
  kind: "for-of";
  await: boolean;
  left: VariableDeclaration | AssignmentTarget;
  right: Value;
  body: Block;
}
