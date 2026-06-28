/**
 * node-create — fabrique de nœuds créés à la main (création de blocs).
 *
 * Phase 1 (visuelle) : on construit un `stmt` (objet structuré) à partir d'un
 * `BlockSpec` issu de la palette/formulaire, PUIS on le projette en
 * `TypedGraphNode` en réutilisant exactement les helpers de `object-to-graph`
 * (label/source/role/astType). Ainsi un node créé est indiscernable d'un node
 * dérivé de l'AST, et son `stmt` est prêt pour le futur round-trip
 * (`convertObjectToAst`).
 *
 * Les expressions saisies au clavier (init de variable, condition, valeur,
 * arguments…) sont parsées avec `@babel/parser` puis converties en `Value`
 * structuré via `valueFromNode` — la même conversion que la lecture AST→objet.
 * Si le parse échoue, on retombe sur un `Value` « brut » qui s'affiche tel quel.
 */

import { parseExpression } from "@babel/parser";
import type { NodeLevel } from "../shared";
import {
  STATEMENT_AST_TYPE,
  labelForStatement,
  roleForStatement,
  sourceForStatement,
} from "./object-to-graph";
import { assignmentTargetFromNode, valueFromNode } from "./node-utils";
import type { Statement, Value } from "./types/globalType";
import type { Argument, Call, Callee } from "./types/functionCall";
import type {
  AssignmentOperator,
  AssignmentTarget,
  DeclarationKind,
  TypeAnnotation,
} from "./types/variable";
import type { TypedGraphNode } from "./typed-nodes";

/**
 * Spécification d'un bloc à créer, produite par la palette (blocs simples) ou le
 * formulaire (blocs avec champs). Plus simple que `Statement` : seuls les champs
 * saisis par l'utilisateur ; `buildStmt` complète le reste.
 */
export type BlockSpec =
  | { kind: "return"; value?: string }
  | { kind: "break" }
  | { kind: "continue" }
  | {
      kind: "variable";
      declarationKind: DeclarationKind;
      name: string;
      typeText?: string;
      initText?: string;
    }
  | {
      kind: "assignment";
      targetText: string;
      operator: AssignmentOperator;
      valueText: string;
    }
  | { kind: "call"; calleeText: string; argsText: string };

/** Les types de blocs proposés par la palette (ordre d'affichage). */
export const PALETTE_KINDS: BlockSpec["kind"][] = [
  "variable",
  "assignment",
  "call",
  "return",
  "break",
  "continue",
];

/** Blocs qui ouvrent un formulaire (sinon insertion immédiate). */
const FORM_KINDS = new Set<BlockSpec["kind"]>([
  "return",
  "variable",
  "assignment",
  "call",
]);

export const needsForm = (kind: BlockSpec["kind"]): boolean => FORM_KINDS.has(kind);

// astType pour l'affichage (icône/couleur via block-meta) — la palette manipule
// le `kind` du BlockSpec, pas le `kind` du Statement.
const KIND_AST_TYPE: Record<BlockSpec["kind"], string> = {
  return: "ReturnStatement",
  break: "BreakStatement",
  continue: "ContinueStatement",
  variable: "VariableDeclaration",
  assignment: "AssignmentExpression",
  call: "CallExpression",
};

/** astType associé à un type de bloc de la palette (pour block-meta). */
export const astTypeForKind = (kind: BlockSpec["kind"]): string =>
  KIND_AST_TYPE[kind];

// Compteur de session pour des ids uniques et non-collisionnants. Les ids des
// nodes dérivés de l'AST sont path-based (`s/0`, `s/0/then/1`…) ; le préfixe
// `new/` les sépare proprement et survit aux re-dérivations (l'op stocke le node).
let seq = 0;

/** Génère un id unique pour un node créé (ex. `new/3`). */
export function nextNodeId(): string {
  return `new/${seq++}`;
}

// --- Parsing des expressions saisies ---------------------------------------

/** Valeur « brute » affichée verbatim — repli si le parse échoue. */
const rawValue = (text: string): Value => ({ kind: "variable", name: text });

/** Texte → `Value` structuré (parse Babel + conversion), repli verbatim. */
function parseValue(text: string): Value {
  const trimmed = text.trim();
  if (!trimmed) return rawValue("");
  try {
    const node = parseExpression(trimmed, { plugins: ["typescript"] });
    return valueFromNode(node) ?? rawValue(trimmed);
  } catch {
    return rawValue(trimmed);
  }
}

/** Texte → cible d'affectation (`x`, `obj.prop`, `arr[i]`), repli variable. */
function parseTarget(text: string): AssignmentTarget {
  const trimmed = text.trim();
  try {
    const node = parseExpression(trimmed, { plugins: ["typescript"] });
    return assignmentTargetFromNode(node) ?? { kind: "variable", name: trimmed };
  } catch {
    return { kind: "variable", name: trimmed };
  }
}

/** Découpe « a, b, c » en arguments (split naïf au 1er niveau — limite connue). */
const splitArgs = (text: string): string[] =>
  text.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

// --- Construction du Statement ----------------------------------------------

/** BlockSpec → objet structuré `Statement` valide. */
function buildStmt(spec: BlockSpec): Statement {
  switch (spec.kind) {
    case "return": {
      const v = spec.value?.trim();
      return v ? { kind: "return", blockUid: 0, value: parseValue(v) } : { kind: "return", blockUid: 0 };
    }
    case "break":
      return { kind: "break" };
    case "continue":
      return { kind: "continue" };
    case "variable": {
      const init = spec.initText?.trim() ? parseValue(spec.initText) : undefined;
      const type: TypeAnnotation | undefined = spec.typeText?.trim()
        ? { kind: "type-reference", name: spec.typeText.trim() }
        : undefined;
      return {
        kind: "variable-declaration",
        declarationKind: spec.declarationKind,
        declarations: [
          {
            target: { kind: "variable", name: spec.name.trim() || "x" },
            ...(init ? { init } : {}),
            ...(type ? { type } : {}),
          },
        ],
        order: 0,
        blockParentId: 0,
        isGlobal: false,
      };
    }
    case "assignment":
      return {
        kind: "assignment",
        operator: spec.operator,
        assignmentTargetName: parseTarget(spec.targetText),
        assignmentTargetValue: parseValue(spec.valueText),
      };
    case "call": {
      const callee = parseValue(spec.calleeText) as Callee;
      const args: Argument[] = splitArgs(spec.argsText).map((a) => parseValue(a));
      const call: Call = { kind: "call", callee, typeArgs: [], args, optional: false };
      return { kind: "expression-statement", value: call };
    }
  }
}

/**
 * Construit le `TypedGraphNode` complet pour un bloc créé. `id` doit être unique
 * dans le graphe courant (voir `nextNodeId`).
 */
export function buildStatementNode(spec: BlockSpec, id: string): TypedGraphNode {
  const stmt = buildStmt(spec);
  const role = roleForStatement(stmt.kind);
  const level: NodeLevel = role === "boundary" ? 1 : 2;
  const source = sourceForStatement(stmt);
  return {
    id,
    astPath: id,
    role,
    track: "spine",
    level,
    label: labelForStatement(stmt),
    astType: STATEMENT_AST_TYPE[stmt.kind] ?? stmt.kind,
    stmt,
    ...(source !== undefined ? { source } : {}),
  } as TypedGraphNode;
}
