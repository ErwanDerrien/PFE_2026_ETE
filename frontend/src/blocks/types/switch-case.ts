// --- Switch statement ---

import type { Statement, Value } from "./globalType";

export interface SwitchStatement {
  uid?: number;
  kind: "switch";
  discriminant: Value;
  cases: SwitchCase[];
}

// --- Case clause ---

export type SwitchCase = ValueCase | DefaultCase;

export interface ValueCase {
  uid?: number;
  kind: "case";
  test: Value; // case 42:  /  case "foo":  /  case x + 1:
  body: Statement[]; // not a Block — no braces around individual cases
}

export interface DefaultCase {
  uid?: number;
  kind: "default";
  body: Statement[]; // default:
}

// --- Break & continue (needed inside switch and loops) ---

export interface BreakStatement {
  kind: "break";
  label?: string; // break outerLoop;
}

export interface ContinueStatement {
  kind: "continue";
  label?: string; // continue outerLoop;
}
