import type { ReturnStatement } from "./types/returnStatement";
import type {
  VariableDeclaration,
  AssignmentExpression as VarAssignmentExpression,
} from "./types/variable";

export interface Param {
  name: string;
  type: string;
  defaultValue?: string;
  isAFunction?: boolean;
}

export interface Expression {
  blockParentId: number;
  order: number;
  variables: VarDeclaration[];
  scope: string;
  isGlobal: boolean;
}

export interface VarDeclaration {
  name: string;
  value: string | FunctionCallDetails | BinaryExpression;
  type: string;
}

export interface VariableAssignement {
  blockParentId: number;
  order: number;
  name: string;
  value: string | FunctionCallDetails | BinaryExpression;
  type: string;
  operator?: string;
}

export interface MemberExpressionAssignment {
  blockParentId: number;
  order: number;
  object: string; // root object: "obj"
  property: string[]; // path: ["prop"] or ["nested", "value"]
  value: string | FunctionCallDetails | BinaryExpression;
  operator?: string;
}

export interface Argument {
  isAFunction: boolean;
  name?: string;
  value?: string;
}

export interface FunctionCallDetails {
  order: number;
  calleeFunctionName: string;
  arguments: Argument[];
  calleeScopeUid?: number; // scope uid of the callee's FunctionDetails in functionMapping
}

export type BinaryOperand = string | FunctionCallDetails | BinaryExpression;

export interface BinaryExpression {
  operator: string;
  leftSideOfOperator: BinaryOperand;
  rightSideOfOperator: BinaryOperand;
}

// VariableDeclaration enriched with position/scope metadata
export type LocatedVariableDeclaration = VariableDeclaration & {
  order: number;
  blockParentId: number;
  isGlobal: boolean;
};

// AssignmentExpression enriched with position/scope metadata
export type LocatedAssignmentExpression = VarAssignmentExpression & {
  order: number;
  blockParentId: number;
};

export interface FunctionDetails {
  scopreUid: number;
  name: string;
  params: Param[];
  declarations: LocatedVariableDeclaration[];
  assignments: LocatedAssignmentExpression[];
  calls: FunctionCallDetails[];
  return?: ReturnStatement;
  subFunctions: FunctionDetails[];
}

export interface FunctionDeclarationName {
  functionDeclarations: string;
}
