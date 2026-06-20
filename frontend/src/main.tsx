import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AstConverterExemple from "./blocks/astConverter/ast-converter-exemple.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AstConverterExemple />
  </StrictMode>,
);
