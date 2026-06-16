// Re-export shim — this file has been split into node-utils.ts and path-extractors.ts.
// Safe to delete once all consumers have been updated.
export {
  getInfoFromBinaryExpression,
  getNodeNameOfTypeIdentifier,
  getTypeScriptType,
  getAssignmentPatternTypeInfo,
  getLiteralValue,
  getInfoFromVariableDeclaratorType,
} from "./node-utils";

export { getFunctionCallInfo } from "./path-extractors";