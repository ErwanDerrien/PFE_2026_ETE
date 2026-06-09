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

export interface FunctionDetails {
  scopreUid: number;
  name: string;
  params: Param[];
  expressions: Expression[];
  assignments: VariableAssignement[];
  calls: FunctionCallDetails[];
  return?: ReturnStatement;
  subFunctions: FunctionDetails[];
}

export interface FunctionDeclarationName {
  functionDeclarations: string;
}

export interface ReturnStatement {
  blockUid: number;
  expression?: BinaryExpression;
  functionCallDetails?: FunctionCallDetails;
}
