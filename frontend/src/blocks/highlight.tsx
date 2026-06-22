/**
 * highlight — surligneur syntaxique maison ultra-léger pour les courtes lignes
 * de code affichées dans les blocs. Pas de dépendance : un simple tokenizer regex
 * qui produit des <span class="tok-…"> stylés dans blocks.css.
 */

import type { ReactNode } from "react";

const KEYWORDS = new Set([
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "try",
  "catch",
  "finally",
  "throw",
  "new",
  "const",
  "let",
  "var",
  "in",
  "of",
  "break",
  "continue",
  "await",
  "yield",
  "typeof",
  "instanceof",
  "interface",
  "class",
  "extends",
]);

// 1: espaces · 2: chaîne · 3: nombre · 4: identifiant · 5: ponctuation
const TOKEN =
  /(\s+)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\d+(?:\.\d+)?)|([A-Za-z_$][\w$]*)|([^\sA-Za-z0-9_$]+)/g;

export function highlight(code: string): ReactNode {
  const out: ReactNode[] = [];
  let key = 0;
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;

  while ((match = TOKEN.exec(code)) !== null) {
    const [, ws, str, num, ident, punct] = match;
    if (ws !== undefined) {
      out.push(ws);
    } else if (str !== undefined) {
      out.push(
        <span key={key++} className="tok-string">
          {str}
        </span>,
      );
    } else if (num !== undefined) {
      out.push(
        <span key={key++} className="tok-number">
          {num}
        </span>,
      );
    } else if (ident !== undefined) {
      const isCall = code[TOKEN.lastIndex] === "(";
      const cls = KEYWORDS.has(ident)
        ? "tok-keyword"
        : isCall
          ? "tok-fn"
          : "tok-ident";
      out.push(
        <span key={key++} className={cls}>
          {ident}
        </span>,
      );
    } else if (punct !== undefined) {
      out.push(
        <span key={key++} className="tok-punct">
          {punct}
        </span>,
      );
    }
  }

  return out;
}
