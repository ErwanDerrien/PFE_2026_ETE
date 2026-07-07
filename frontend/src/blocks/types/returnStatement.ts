import type { Value } from "./globalType";

export interface ReturnStatement {
  blockUid: number;
  kind: "return";
  value?: Value;
}
