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

import type { AstToGraph, Generate, Parse } from "../shared";
import { DEFAULT_LANGUAGE, LANGUAGE_CONFIG } from "../shared";
import { parse as babelParser } from "@babel/parser";
import _generate from "@babel/generator";
import traversePath from "../blocks/ast-mapping";
import { objectToGraph } from "../blocks/object-to-graph";
import type {
  FunctionDeclaration,
  FunctionValue,
} from "../blocks/types/function";
import { convertObjectToAst } from "../blocks/astConverter/ast-converter";
import type { File } from "@babel/types"

/**
 * code -> AST. À implémenter avec :
 *   `parse(source, LANGUAGE_CONFIG[language].parserOptions)` depuis `@babel/parser`.
 */
export const parse: Parse = (source, language = DEFAULT_LANGUAGE) => {
  return babelParser(source, LANGUAGE_CONFIG[language].parserOptions);
};

// Interop ESM/CJS de @babel/generator (cf. ast-mapping pour @babel/traverse).
const generator =
  typeof _generate === "function"
    ? _generate
    : (_generate as { default: typeof _generate }).default;

/** AST -> code, via `@babel/generator`. */
export const generate: Generate = (ast) => generator(ast).code;

/**
 * AST -> graphe de blocs. Cœur en lecture.
 * On passe par l'objet structuré (`traversePath`) puis on le projette en
 * `GraphModel` via `objectToGraph` (voir ../blocks/object-to-graph.ts).
 */
export const astToGraph: AstToGraph = (ast, options) => {
  console.log(traversePath(ast));
  return objectToGraph(traversePath(ast), options);
};

/**
 * graphe de blocs -> AST. Cœur en édition (le plus difficile).
 * Parcourir l'ordre de la spine des nœuds connectés et reconstruire l'AST en
 * mettant `base` à jour (poignées typées pour garantir des connexions valides).
 */
export const graphToAst = (
  codeObj: FunctionDeclaration | FunctionValue,
): File => {
  return convertObjectToAst(codeObj);
};
