/**
 * Les quatre transformations qui relient l'AST Babel (source de vérité) aux vues.
 *
 * ⚠️ SCAFFOLD — ces fonctions sont des STUBS typés. Elles définissent le contrat
 * exact (signatures importées depuis /shared) mais ne sont pas encore implémentées.
 * C'est le cœur du travail de l'équipe A.
 *
 * Ordre de mise en œuvre conseillé (cf. notes d'architecture) :
 *   1. `parse`     — wrapper d'une ligne autour de `@babel/parser`.
 *   2. `generate`  — wrapper autour de `@babel/generator`.
 *   3. `astToGraph`— marcher le `body[]` du Program/BlockStatement : chaque
 *                    statement -> nœud spine ; expressions -> sous-nœuds latéraux.
 *   4. `graphToAst`— le plus dur : reconstruire un AST valide depuis le graphe.
 */

import type { Generate, GraphToAst, Parse } from "../shared";
import { DEFAULT_LANGUAGE, LANGUAGE_CONFIG } from "../shared";
import { parse as babelParser } from "@babel/parser";
import traversePath from "../blocks/ast-mapping";

/** Lève une erreur explicite tant qu'une transformation n'est pas implémentée. */
function notImplemented(fn: string, context: string): never {
  throw new Error(
    `[sync] ${fn}() non implémenté — TODO équipe A. Contexte : ${context}`,
  );
}

/**
 * code -> AST. À implémenter avec :
 *   `parse(source, LANGUAGE_CONFIG[language].parserOptions)` depuis `@babel/parser`.
 */
export const parse: Parse = (source, language = DEFAULT_LANGUAGE) => {
  return babelParser(source, LANGUAGE_CONFIG[language].parserOptions);
};

/** AST -> code. À implémenter avec `generate(ast).code` depuis `@babel/generator`. */
export const generate: Generate = (ast) =>
  notImplemented("generate", `racine AST=${ast.type}`);

/**
 * AST -> graphe de blocs. Cœur en lecture.
 * Marcher l'AST avec `@babel/traverse`, marquer chaque nœud `track: 'spine'`
 * ou `'expression'`, et appliquer le regroupement par lignes vides (Niveau 1).
 */

export const astToGraph = (ast: Node) => {
  const result = traversePath(ast);
  console.log(result);
};

/**
 * graphe de blocs -> AST. Cœur en édition (le plus difficile).
 * Parcourir l'ordre de la spine des nœuds connectés et reconstruire l'AST en
 * mettant `base` à jour (poignées typées pour garantir des connexions valides).
 */
export const graphToAst: GraphToAst = (graph, base) =>
  notImplemented(
    "graphToAst",
    `${graph.nodes.length} nœud(s), ${graph.edges.length} arête(s), base=${base.type}`,
  );
