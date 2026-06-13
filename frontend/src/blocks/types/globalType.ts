import type { FunctionDeclaration, FunctionValue } from "./function";
import type { NewCall, TaggedTemplate } from "./functionCall";
import type { ReturnStatement } from "./returnStatement";
import type {
  ArrayValue,
  AssignmentExpression,
  Await,
  BinaryOp,
  Call,
  IndexAccess,
  Literal,
  ObjectValue,
  PropertyAccess,
  TemplateString,
  Ternary,
  UnaryOp,
  VariableDeclaration,
  VariableRef,
  Yield,
} from "./variable";

export type Statement =
  | VariableDeclaration
  | AssignmentExpression
  | ReturnStatement
  | FunctionDeclaration
  | ExpressionStatement;

interface ExpressionStatement {
  kind: "expression-statement";
  value: Value;
}

export type Value =
  | Literal
  | VariableRef
  | PropertyAccess
  | IndexAccess
  | Call // foo(), obj.method(), foo?.()
  | NewCall // new Foo()
  | TaggedTemplate // css`...`
  | AssignmentExpression
  | BinaryOp
  | UnaryOp
  | Ternary
  | FunctionValue
  | ArrayValue
  | ObjectValue
  | TemplateString
  | Await
  | Yield;
