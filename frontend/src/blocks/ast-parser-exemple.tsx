import { code, nestedCode } from "./constant";
import { astToGraph, parse } from "../sync/transforms";
import type { SupportedLanguage } from "../shared/ast";

const AstParserExample = () => {
  const parsedCode = parse(code, "typescript" as SupportedLanguage);
  const nestedCodeParsed = parse(nestedCode, "typescript" as SupportedLanguage);

  astToGraph(parsedCode, {});
  // astToGraph(code, {});
  return (
    <div>
      <h1>Ast Parser Example</h1>
      <pre>{JSON.stringify(parsedCode, null, 2)}</pre>
    </div>
  );
};

export default AstParserExample;
