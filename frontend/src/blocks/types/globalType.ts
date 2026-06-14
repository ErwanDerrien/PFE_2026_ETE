import type { FunctionDeclaration, FunctionValue } from "./function";
import type { Call, NewCall, TaggedTemplate } from "./functionCall";
import type { IfStatement } from "./ifStatement";
import type { InterfaceDeclaration } from "./interface";
import type {
  DoWhileStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  WhileStatement,
} from "./loops";
import type { ReturnStatement } from "./returnStatement";
import type {
  BreakStatement,
  ContinueStatement,
  SwitchStatement,
} from "./switch-case";
import type { ThrowStatement, TryStatement } from "./tryCatch";
import type {
  ArrayValue,
  AssignmentExpression,
  Await,
  BinaryOp,
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
  | ExpressionStatement
  | SwitchStatement
  | BreakStatement
  | ContinueStatement
  | InterfaceDeclaration
  | IfStatement
  | WhileStatement
  | DoWhileStatement
  | ForStatement
  | ForInStatement
  | ForOfStatement
  | TryStatement
  | ThrowStatement;

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

export interface Block {
  kind: "block";
  content: Statement[];
}
