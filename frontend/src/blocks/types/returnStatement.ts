import type { Value } from "./variable";

export interface ReturnStatement {
  blockUid: number;
  kind: "return";
  value?: Value;
}
