import type { Block, Value } from "./globalType";

export interface IfStatement {
  uid?: number;
  kind: "if";
  condition: Value;
  then: Block;
  else?: Block | IfStatement; // Block → else { }   IfStatement → else if (...)
}
