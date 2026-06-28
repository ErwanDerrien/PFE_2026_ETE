/**
 * type-options — catalogue des types sélectionnables lors de la création/édition
 * d'une variable (permissibilité : on ne tape pas un type au hasard, on choisit
 * parmi ce qui existe).
 *
 * Sources :
 *  - les types primitifs TypeScript (liste fixe) ;
 *  - les types nommés DÉCLARÉS dans le code (interfaces présentes dans le graphe).
 *
 * `parseTypeText` convertit le choix en `TypeAnnotation` structuré (primitive vs
 * référence nommée) — prêt pour le round-trip.
 */

import type { GraphModel } from "../shared";
import type { TypedGraphNode } from "./typed-nodes";
import type { InterfaceDeclaration } from "./types/interface";
import type { PrimitiveType, TypeAnnotation } from "./types/variable";

/** Types primitifs TypeScript (cf. `PrimitiveType` dans types/variable.ts). */
export const PRIMITIVE_TYPE_NAMES: PrimitiveType["name"][] = [
  "string",
  "number",
  "boolean",
  "bigint",
  "symbol",
  "null",
  "undefined",
  "void",
  "never",
  "any",
  "unknown",
];

const isPrimitive = (name: string): name is PrimitiveType["name"] =>
  (PRIMITIVE_TYPE_NAMES as string[]).includes(name);

/** Noms de types déclarés dans le code (interfaces du graphe), triés et dédupliqués. */
export function namedTypesFromGraph(graph: GraphModel): string[] {
  const names = new Set<string>();
  for (const node of graph.nodes as TypedGraphNode[]) {
    const stmt = node.stmt as { kind?: string } | undefined;
    if (stmt?.kind === "interface-declaration") {
      names.add((node.stmt as InterfaceDeclaration).name);
    }
  }
  return [...names].sort();
}

/** Texte de type sélectionné → `TypeAnnotation` (ou `undefined` si vide). */
export function parseTypeText(text: string): TypeAnnotation | undefined {
  const t = text.trim();
  if (!t) return undefined;
  return isPrimitive(t) ? { kind: "primitive", name: t } : { kind: "type-reference", name: t };
}
