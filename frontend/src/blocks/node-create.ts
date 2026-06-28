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
  describe,
  describeBinding,
  describeTarget,
  describeType,
  labelForStatement,
  roleForStatement,
  sourceForStatement,
} from "./object-to-graph";
import { assignmentTargetFromNode, valueFromNode } from "./node-utils";
import { parseTypeText } from "./type-options";
import type { Statement, Value } from "./types/globalType";
import type { Argument, Call, Callee } from "./types/functionCall";
import type {
  AssignmentOperator,
  AssignmentTarget,
  DeclarationKind,
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
  | { kind: "call"; calleeText: string; argsText: string }
  | { kind: "if"; conditionText: string }
  | { kind: "while"; conditionText: string }
  | {
      kind: "for";
      declarationKind: DeclarationKind;
      varName: string;
      initText?: string;
      testText?: string;
      updateText?: string;
    };

/** Les types de blocs proposés par la palette (ordre d'affichage). */
export const PALETTE_KINDS: BlockSpec["kind"][] = [
  "variable",
  "assignment",
  "call",
  "if",
  "while",
  "for",
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
  "if",
  "while",
  "for",
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
  if: "IfStatement",
  while: "WhileStatement",
  for: "ForStatement",
};

/** astType associé à un type de bloc de la palette (pour block-meta). */
export const astTypeForKind = (kind: BlockSpec["kind"]): string =>
  KIND_AST_TYPE[kind];

// Libellés de palette distincts là où block-meta regroupe (while/for → « LOOP »).
const KIND_LABEL: Partial<Record<BlockSpec["kind"], string>> = {
  while: "WHILE",
  for: "FOR",
};

/** Libellé affiché dans la palette ; distingue les blocs regroupés par block-meta. */
export const paletteLabel = (kind: BlockSpec["kind"], fallback: string): string =>
  KIND_LABEL[kind] ?? fallback;

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
export function parseValue(text: string): Value {
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
      const type = parseTypeText(spec.typeText ?? "");
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
    case "if":
      // Corps `then` vide : on le remplit ensuite via les slots « + » des ports.
      return { kind: "if", condition: parseValue(spec.conditionText), then: { kind: "block", content: [] } };
    case "while":
      return { kind: "while", condition: parseValue(spec.conditionText), body: { kind: "block", content: [] } };
    case "for": {
      const init = spec.varName.trim()
        ? {
            kind: "variable-declaration" as const,
            declarationKind: spec.declarationKind,
            declarations: [
              {
                target: { kind: "variable" as const, name: spec.varName.trim() },
                ...(spec.initText?.trim() ? { init: parseValue(spec.initText) } : {}),
              },
            ],
            order: 0,
            blockParentId: 0,
            isGlobal: false,
          }
        : undefined;
      const test = spec.testText?.trim() ? parseValue(spec.testText) : undefined;
      const update = spec.updateText?.trim() ? parseValue(spec.updateText) : undefined;
      return {
        kind: "for",
        ...(init ? { init } : {}),
        ...(test ? { test } : {}),
        ...(update ? { update } : {}),
        body: { kind: "block", content: [] },
      };
    }
  }
}

// --- Inverse : node existant → BlockSpec (pré-remplissage de la sidebar) ------

const argText = (a: Argument): string =>
  describe(a.kind === "spread-arg" ? a.value : a);

/**
 * Reconstruit le `BlockSpec` d'un node existant pour pré-remplir le formulaire
 * d'édition. Inverse (approximatif) de `buildStmt` : les sous-expressions sont
 * rendues en texte via `describe`. Retourne `null` pour les types non éditables
 * (fonction, switch, try, interface, for-of/in, do-while…).
 */
export function specFromNode(node: TypedGraphNode): BlockSpec | null {
  const stmt = node.stmt as Statement;
  switch (stmt.kind) {
    case "return":
      return { kind: "return", value: stmt.value ? describe(stmt.value) : "" };
    case "break":
      return { kind: "break" };
    case "continue":
      return { kind: "continue" };
    case "variable-declaration": {
      const d = stmt.declarations[0];
      if (!d) return null;
      return {
        kind: "variable",
        declarationKind: stmt.declarationKind,
        name: describeBinding(d.target),
        typeText: d.type ? describeType(d.type) : "",
        initText: d.init ? describe(d.init) : "",
      };
    }
    case "assignment":
      return {
        kind: "assignment",
        targetText: describeTarget(stmt.assignmentTargetName),
        operator: stmt.operator,
        valueText: describe(stmt.assignmentTargetValue),
      };
    case "expression-statement":
      if (stmt.value.kind !== "call") return null;
      return {
        kind: "call",
        calleeText: describe(stmt.value.callee),
        argsText: stmt.value.args.map(argText).join(", "),
      };
    case "if":
      return { kind: "if", conditionText: describe(stmt.condition) };
    case "while":
      return { kind: "while", conditionText: describe(stmt.condition) };
    case "for": {
      const init = stmt.init;
      const decl = init?.kind === "variable-declaration" ? init.declarations[0] : undefined;
      return {
        kind: "for",
        declarationKind:
          init?.kind === "variable-declaration" ? init.declarationKind : "let",
        varName: decl ? describeBinding(decl.target) : "",
        initText: decl?.init ? describe(decl.init) : "",
        testText: stmt.test ? describe(stmt.test) : "",
        updateText: stmt.update ? describe(stmt.update) : "",
      };
    }
    default:
      return null;
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
