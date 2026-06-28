/**
 * var-refs — extraction des noms de variables DÉCLARÉS et RÉFÉRENCÉS par un
 * statement, depuis l'objet structuré (`stmt`) conservé sur chaque node.
 *
 * Sert au « slice » de suppression : supprimer une variable doit aussi supprimer
 * tout ce qui la référence (cf. graph-edit.ts:collectVariableDeletionIds).
 *
 * Pur, sans dépendance React/graphe. Calqué sur `describe`/`childValues` de
 * object-to-graph.ts : on parcourt récursivement toutes les formes de `Value`.
 *
 * Limite connue : on ne descend pas dans le corps d'une arrow inline
 * (`const f = () => count`) — cohérent avec `childValues`.
 */

import type { Statement, Value } from "./types/globalType";
import type { Argument } from "./types/functionCall";
import type {
  AssignmentTarget,
  BindingTarget,
  Spread,
} from "./types/variable";

// --- Valeurs → noms de variables lues ---------------------------------------

const argVars = (a: Argument): string[] =>
  a.kind === "spread-arg" ? valueVars(a.value) : valueVars(a);

const elementVars = (e: Value | Spread | null): string[] =>
  e == null ? [] : e.kind === "spread" ? valueVars(e.value) : valueVars(e);

/** Tous les noms de variables référencées (lues) dans une `Value`. */
function valueVars(v: Value): string[] {
  switch (v.kind) {
    case "variable":
      return [v.name];
    case "property":
      return valueVars(v.object);
    case "index":
      return [...valueVars(v.object), ...valueVars(v.index)];
    case "call":
      return [...valueVars(v.callee), ...v.args.flatMap(argVars)];
    case "new":
      return [...valueVars(v.callee), ...v.args.flatMap(argVars)];
    case "tagged-template":
      return [...valueVars(v.tag), ...v.template.expressions.flatMap(valueVars)];
    case "assignment":
      return [
        ...valueVars(v.assignmentTargetValue),
        ...targetVars(v.assignmentTargetName),
      ];
    case "binary":
      return [...valueVars(v.left), ...valueVars(v.right)];
    case "unary":
      return valueVars(v.value);
    case "ternary":
      return [
        ...valueVars(v.condition),
        ...valueVars(v.then),
        ...valueVars(v.else),
      ];
    case "array":
      return v.elements.flatMap(elementVars);
    case "object":
      return v.properties.flatMap((p) => valueVars(p.value));
    case "template":
      return v.expressions.flatMap(valueVars);
    case "await":
      return valueVars(v.value);
    case "yield":
      return v.value ? valueVars(v.value) : [];
    default:
      // literal, function (arrow body non descendu)
      return [];
  }
}

/** Racine(s) variable lue(s) par une cible d'affectation (ex. `obj.x`, `a[i]`). */
function targetVars(t: AssignmentTarget): string[] {
  switch (t.kind) {
    case "variable":
      return [t.name];
    case "property":
      return valueVars(t.object);
    case "index":
      return [...valueVars(t.object), ...valueVars(t.index)];
    default:
      // array/object-destructure : cibles d'écriture, ignorées ici
      return [];
  }
}

// --- Déclarations → noms liés (gère la déstructuration) ---------------------

/** Noms liés par un pattern de binding/déstructuration. */
function patternNames(t: BindingTarget | AssignmentTarget): string[] {
  switch (t.kind) {
    case "variable":
      return [t.name];
    case "array-destructure":
      return t.elements.flatMap((el) => {
        if (el == null) return [];
        if (el.kind === "rest" || el.kind === "defaulted")
          return patternNames(el.target);
        return patternNames(el);
      });
    case "object-destructure":
      return t.properties.flatMap((p) => {
        if (p.kind === "rest") return patternNames(p.target);
        if (p.nested) return patternNames(p.nested);
        return [p.alias ?? p.key];
      });
    default:
      return [];
  }
}

/** Noms déclarés par un statement (uniquement les variable-declaration). */
export function declaredNames(stmt: Statement): string[] {
  if (stmt.kind !== "variable-declaration") return [];
  return stmt.declarations.flatMap((d) => patternNames(d.target));
}

/** Noms de variables référencées (lues) par un statement, à son propre niveau. */
export function referencedNames(stmt: Statement): string[] {
  switch (stmt.kind) {
    case "variable-declaration":
      return stmt.declarations.flatMap((d) => (d.init ? valueVars(d.init) : []));
    case "assignment":
      return [
        ...valueVars(stmt.assignmentTargetValue),
        ...targetVars(stmt.assignmentTargetName),
      ];
    case "return":
      return stmt.value ? valueVars(stmt.value) : [];
    case "throw":
      return valueVars(stmt.value);
    case "expression-statement":
      return valueVars(stmt.value);
    case "if":
      return valueVars(stmt.condition);
    case "while":
    case "do-while":
      return valueVars(stmt.condition);
    case "switch":
      return valueVars(stmt.discriminant);
    case "for": {
      const initVars = stmt.init
        ? stmt.init.kind === "variable-declaration"
          ? stmt.init.declarations.flatMap((d) => (d.init ? valueVars(d.init) : []))
          : valueVars(stmt.init)
        : [];
      return [
        ...initVars,
        ...(stmt.test ? valueVars(stmt.test) : []),
        ...(stmt.update ? valueVars(stmt.update) : []),
      ];
    }
    case "for-in":
    case "for-of": {
      const leftVars =
        stmt.left.kind === "variable-declaration" ? [] : targetVars(stmt.left);
      return [...valueVars(stmt.right), ...leftVars];
    }
    default:
      // function-declaration, interface-declaration, break, continue
      return [];
  }
}
