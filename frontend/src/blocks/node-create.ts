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
 * M1 : blocs simples sans formulaire (return / break / continue). Les blocs avec
 * formulaire (variable, call, if, boucles…) viennent dans les milestones suivants
 * en étendant `BlockSpec` + `buildStmt`.
 */

import type { NodeLevel } from "../shared";
import {
  STATEMENT_AST_TYPE,
  labelForStatement,
  roleForStatement,
  sourceForStatement,
} from "./object-to-graph";
import type { Statement } from "./types/globalType";
import type { TypedGraphNode } from "./typed-nodes";

/**
 * Spécification d'un bloc à créer, produite par la palette (et plus tard le
 * formulaire). Volontairement plus simple que `Statement` : seuls les champs
 * saisis par l'utilisateur, le reste est rempli par `buildStmt`.
 */
export type BlockSpec =
  | { kind: "return" }
  | { kind: "break" }
  | { kind: "continue" };

/** Les types de blocs proposés par la palette pour cette milestone. */
export const PALETTE_KINDS: BlockSpec["kind"][] = ["return", "break", "continue"];

// Compteur de session pour des ids uniques et non-collisionnants. Les ids des
// nodes dérivés de l'AST sont path-based (`s/0`, `s/0/then/1`…) ; le préfixe
// `new/` les sépare proprement et survit aux re-dérivations (l'op stocke le node).
let seq = 0;

/** Génère un id unique pour un node créé (ex. `new/3`). */
export function nextNodeId(): string {
  return `new/${seq++}`;
}

/** BlockSpec → objet structuré `Statement` valide. */
function buildStmt(spec: BlockSpec): Statement {
  switch (spec.kind) {
    case "return":
      // `value` optionnel : `return;` est valide. La saisie d'une valeur arrive
      // avec le formulaire (milestone ultérieure).
      return { kind: "return", blockUid: 0 };
    case "break":
      return { kind: "break" };
    case "continue":
      return { kind: "continue" };
  }
}

/**
 * Construit le `TypedGraphNode` complet pour un bloc créé. `id` doit être unique
 * dans le graphe courant (voir le compteur d'insertions du store).
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
