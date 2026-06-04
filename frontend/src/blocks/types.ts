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
  value: string | FunctionCallDetails;
  type: string;
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

export interface BinaryExpression {
  operator: string; // e.g., '+', '-', '*', '/',
  leftSideOfOperator: string;
  rightSideOfOperator: string;
}
export interface FunctionDetails {
  scopreUid: number;
  name: string;
  params: Param[];
  expressions: Expression[];
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
