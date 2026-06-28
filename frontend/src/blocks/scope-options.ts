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
import { isLooping } from "./block-meta";
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

/** Collecte récursivement les noms liés par un pattern (id, destructuration, défaut, rest). */
function collectBindingNames(node: t.Node | null | undefined, out: Set<string>): void {
  if (!node) return;
  if (t.isIdentifier(node)) out.add(node.name);
  else if (t.isObjectPattern(node)) {
    for (const p of node.properties) {
      if (t.isObjectProperty(p)) collectBindingNames(p.value as t.Node, out);
      else collectBindingNames(p.argument, out); // RestElement
    }
  } else if (t.isArrayPattern(node)) {
    for (const el of node.elements) collectBindingNames(el, out);
  } else if (t.isAssignmentPattern(node)) collectBindingNames(node.left, out);
  else if (t.isRestElement(node)) collectBindingNames(node.argument, out);
  else if (t.isTSParameterProperty(node)) collectBindingNames(node.parameter, out);
}

/**
 * Tous les noms LIÉS (déclarés) dans le code, depuis l'AST : fonctions, variables
 * (tous patterns), paramètres, catch. Sert à vérifier qu'une référence existe —
 * une valeur identifiant nu non déclarée est probablement une chaîne sans
 * guillemets.
 */
export function allBindingNamesFromAst(ast: File | null): Set<string> {
  const names = new Set<string>();
  if (!ast) return names;
  traverse(ast, {
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      if (path.node.id) names.add(path.node.id.name);
    },
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      collectBindingNames(path.node.id, names);
    },
    Function(path: NodePath<t.Function>) {
      for (const param of path.node.params) collectBindingNames(param, names);
    },
    CatchClause(path: NodePath<t.CatchClause>) {
      collectBindingNames(path.node.param, names);
    },
  });
  return names;
}

/**
 * Noms RÉASSIGNABLES déclarés dans le code : variables `let`/`var` (les `const`
 * sont exclus — non réassignables) et paramètres de fonction. Collecte GLOBALE
 * (sans portée) — sert de repli quand on n'a pas de point d'ancrage.
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

// --- Scope lexical pour la cible d'une affectation --------------------------
//
// Les ids de nodes sont path-based (`s/2/then/1`) : un statement a pour chemin
// `<blocPath>/<index>`, et un bloc imbriqué est `<statementPath>/<motclé>`
// (`/then`, `/else`, `/body`, `/try`, `/catch`, `/finally`, `/caseN`). On en
// déduit le nesting (= portée lexicale) et l'ordre (= « déclaré avant »).

/** Point d'ancrage d'où calculer la portée : un node existant (édition) ou une
 *  insertion (création). */
export type ScopeAnchor =
  | { kind: "node"; nodeId: string }
  | { kind: "insert"; target: InsertTarget };

/**
 * Un candidat (chemin `Pv`) est-il visible et déclaré AVANT le point `Pa` ?
 * Vrai si `Pv = B/k` avec `B` un bloc ancêtre de `Pa` et `k` antérieur à l'index
 * par lequel `Pa` traverse `B`. `inclusive` autorise le node d'ancrage lui-même
 * (insertion « après » ce node).
 */
function inScopeBefore(Pv: string, Pa: string, inclusive: boolean): boolean {
  if (Pv === Pa) return inclusive;
  const ls = Pv.lastIndexOf("/");
  if (ls < 0) return false;
  const block = Pv.slice(0, ls);
  const k = Number(Pv.slice(ls + 1));
  if (Number.isNaN(k)) return false; // pas un statement « simple » (ex. else-if)
  if (!Pa.startsWith(block + "/")) return false; // block doit être un préfixe-bloc de Pa
  const j = Number(Pa.slice(block.length + 1).split("/")[0]);
  if (Number.isNaN(j)) return false;
  return k < j;
}

/** Résout un ScopeAnchor en (chemin d'ancrage, inclusif du node d'ancrage). */
function resolveAnchor(
  graph: GraphModel,
  anchor: ScopeAnchor,
): { path: string; inclusive: boolean } | null {
  if (anchor.kind === "node") return { path: anchor.nodeId, inclusive: false };
  const t = anchor.target;
  if (t.kind === "port") return { path: t.nodeId, inclusive: true };
  // edge : le nouveau node se place après la source de l'arête.
  const edge = graph.edges.find((e) => e.id === t.edgeId);
  return edge ? { path: edge.source, inclusive: true } : null;
}

/**
 * Noms réassignables EN PORTÉE au point d'ancrage : variables `let`/`var`
 * déclarées avant dans le bloc courant ou un bloc ancêtre (closures incluses) +
 * paramètres des fonctions englobantes. Exclut `const`, les fonctions sœurs et
 * tout ce qui est déclaré plus tard.
 */
export function reassignableInScope(graph: GraphModel, anchor: ScopeAnchor): string[] {
  const resolved = resolveAnchor(graph, anchor);
  if (!resolved) return reassignableNames(graph); // repli prudent
  const { path: Pa, inclusive } = resolved;
  const names = new Set<string>();

  for (const node of graph.nodes as TypedGraphNode[]) {
    const stmt = node.stmt as Statement | undefined;
    if (!stmt) continue;

    // Variables let/var visibles et déclarées avant.
    if (stmt.kind === "variable-declaration" && stmt.declarationKind !== "const") {
      if (inScopeBefore(node.id, Pa, inclusive)) {
        for (const n of declaredNames(stmt)) names.add(n);
      }
    }

    // Paramètres d'une fonction englobante (son corps est un ancêtre de Pa).
    if (stmt.kind === "function-declaration") {
      const bodyBlock = `${node.id}/body`;
      if (Pa.startsWith(`${bodyBlock}/`)) {
        for (const p of (stmt as FunctionDeclaration).params) {
          const pn = simpleParamName(p);
          if (pn) names.add(pn);
        }
      }
    }
  }

  return [...names].sort();
}
