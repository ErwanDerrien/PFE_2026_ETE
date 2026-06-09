import {
  code,
  nestedCode,
  assignmentSimple,
  assignmentCompoundArithmetic,
  assignmentCompoundBitwise,
  assignmentCompoundLogical,
  assignmentMemberExpression,
  assignmentComputedMember,
  assignmentArrayPattern,
  assignmentObjectPattern,
} from "./constant";
import { astToGraph, parse } from "../sync/transforms";
import type { SupportedLanguage } from "../shared/ast";

const lang = "typescript" as SupportedLanguage;

const AstParserExample = () => {
  const parsedCode = parse(code, lang);
  const nestedCodeParsed = parse(nestedCode, lang);

  // const parsedSimple = parse(assignmentSimple, lang);
  const parsedCompoundArithmetic = parse(assignmentCompoundArithmetic, lang);
  // const parsedCompoundBitwise = parse(assignmentCompoundBitwise, lang);
  // const parsedCompoundLogical = parse(assignmentCompoundLogical, lang);
  // const parsedMemberExpression = parse(assignmentMemberExpression, lang);
  // const parsedComputedMember = parse(assignmentComputedMember, lang);
  // const parsedArrayPattern = parse(assignmentArrayPattern, lang);
  // const parsedObjectPattern = parse(assignmentObjectPattern, lang);

  // astToGraph(parsedSimple);
  astToGraph(parsedCompoundArithmetic);
  // astToGraph(parsedCompoundBitwise);
  // astToGraph(parsedCompoundLogical);
  // astToGraph(parsedMemberExpression);
  // astToGraph(parsedComputedMember);
  // astToGraph(parsedArrayPattern);
  // astToGraph(parsedObjectPattern);

  return (
    <div>
      <h1>Ast Parser Example</h1>
      <pre>{JSON.stringify(parsedCode, null, 2)}</pre>
    </div>
  );
};

export default AstParserExample;
