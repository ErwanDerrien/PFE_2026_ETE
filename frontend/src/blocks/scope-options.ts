/**
 * scope-options — listes de noms dérivées du code pour restreindre les saisies
 * (permissibilité). On ne tape pas un identifiant au hasard : on choisit parmi
 * ce qui existe réellement.
 *
 * Limite connue (phase visuelle) : collecte GLOBALE, sans analyse de portée fine
 * (une variable d'une autre fonction reste proposée). À raffiner avec un vrai
 * calcul de scope plus tard.
 */

import _traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { File } from "@babel/types";
import type { GraphModel, InsertTarget } from "../shared";
import type { TypedGraphNode } from "./typed-nodes";
import type { FunctionDeclaration } from "./types/function";
import type { Statement } from "./types/globalType";
import type { Parameter } from "./types/parameter";
import { declaredNames } from "./var-refs";

// Interop ESM/CJS de @babel/traverse (cf. ast-mapping.ts).
const traverse =
  typeof _traverse === "function" ? _traverse : (_traverse as { default: typeof _traverse }).default;

/** Nom d'un paramètre simple (ignore la déstructuration pour l'instant). */
function simpleParamName(p: Parameter): string | null {
  switch (p.kind) {
    case "param":
    case "default-param":
    case "rest-param":
      return p.name;
    default:
      return null; // destructured-param
  }
}

/**
 * Noms APPELABLES déclarés dans le code, collectés depuis l'AST (source de
 * vérité) — donc indépendant de l'état replié/déplié des nodes : toute fonction
 * du code apparaît, qu'elle soit visible comme node ou non.
 *
 * Couvre les déclarations de fonction (`function foo() {}`) et les variables liées
 * à une fonction (`const f = () => …`, `const g = function () {}`). Collecte
 * globale (toutes portées) ; un raffinement par portée pourra suivre.
 */
export function callableNamesFromAst(ast: File | null): string[] {
  if (!ast) return [];
  const names = new Set<string>();
  traverse(ast, {
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      if (path.node.id) names.add(path.node.id.name);
    },
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      const init = path.node.init;
      if (
        (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) &&
        t.isIdentifier(path.node.id)
      ) {
        names.add(path.node.id.name);
      }
    },
  });
  return [...names].sort();
}

/**
 * Noms RÉASSIGNABLES déclarés dans le code : variables `let`/`var` (les `const`
 * sont exclus — non réassignables) et paramètres de fonction. Sert au dropdown de
 * cible d'une affectation.
 */
export function reassignableNames(graph: GraphModel): string[] {
  const names = new Set<string>();
  for (const node of graph.nodes as TypedGraphNode[]) {
    const stmt = node.stmt as Statement | undefined;
    if (!stmt) continue;
    if (stmt.kind === "variable-declaration" && stmt.declarationKind !== "const") {
      for (const n of declaredNames(stmt)) names.add(n);
    } else if (stmt.kind === "function-declaration") {
      for (const p of (stmt as FunctionDeclaration).params) {
        const pn = simpleParamName(p);
        if (pn) names.add(pn);
      }
    }
  }
  return [...names].sort();
}
