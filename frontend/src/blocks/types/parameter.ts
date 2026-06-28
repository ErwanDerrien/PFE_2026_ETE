import type { Value } from "./globalType";
import type {
  ArrayDestructure,
  ObjectDestructure,
  TypeAnnotation,
  TypeParam,
} from "./variable";

export type { TypeParam };

export type Parameter =
  | SimpleParam
  | DefaultParam
  | DestructuredParam
  | RestParam;

export interface SimpleParam {
  kind: "param";
  name: string;
  type?: TypeAnnotation;
  optional?: boolean; // TypeScript: foo(x?: string)
}

export interface DefaultParam {
  kind: "default-param";
  name: string;
  default: Value;
  type?: TypeAnnotation; // foo(x: string = "hi")
}

export interface DestructuredParam {
  kind: "destructured-param";
  target: ArrayDestructure | ObjectDestructure;
  type?: TypeAnnotation; // foo({ a, b }: Point)
}

export interface RestParam {
  kind: "rest-param";
  name: string;
  type?: TypeAnnotation; // foo(...args: string[])
}

