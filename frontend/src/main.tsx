import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./shell/App.tsx";
import AstParserExample from "./blocks/ast-parser-exemple.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AstParserExample />
    <App />
  </StrictMode>,
);
