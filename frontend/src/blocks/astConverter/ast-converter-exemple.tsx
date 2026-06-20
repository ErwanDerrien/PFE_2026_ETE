import type { SupportedLanguage } from "../../shared/ast";
import { astToGraph, graphToAst, parse } from "../../sync/transforms";
import { variablesCode } from "../constant";
import { generate } from "../node-utils";

const lang = "typescript" as SupportedLanguage;
export default function AstConverterExemple() {
  const variableCodeParsed = parse(variablesCode, lang);
  const ast = astToGraph(variableCodeParsed);
  const res = graphToAst(ast);
  return (
    <div style={{ width: "100%" }}>
      <h1>Ast Converter</h1>
      <div>
        <h2>Code</h2>
        <pre
          style={{
            backgroundColor: "#282c34",
            color: "#fff",
            padding: "15px",
            borderRadius: "5px",
            width: "100%",
          }}
        >
          <code style={{ display: "block", textAlign: "left" }}>{generate(res).code}</code>
        </pre>
      </div>
    </div>
  );
}
