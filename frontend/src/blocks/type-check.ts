/**
 * type-check — validation (best-effort) de la cohérence de types pour une
 * affectation : la valeur donnée doit correspondre au type de la variable cible.
 *
 * Philosophie : on ne bloque QUE sur une incompatibilité CERTAINE entre types
 * primitifs (number / string / boolean). Dès qu'un type est indéterminé
 * (expression complexe, appel, type nommé…), on laisse passer — zéro faux
 * positif. L'inférence est volontairement simple ; un vrai type-checker viendra
 * plus tard.
 */

import type { File } from "@babel/types";
import type { GraphModel } from "../shared";
import type { FormValues } from "./Components/BlockFields";
import { parseValue } from "./node-create";
import { allBindingNamesFromAst, namesInScope, type ScopeAnchor } from "./scope-options";
import type { BlockSpec } from "./node-create";
import type { TypedGraphNode } from "./typed-nodes";
import type { Value } from "./types/globalType";
import type { TypeAnnotation } from "./types/variable";
import { valueVars } from "./var-refs";

// Identifiants « globaux » acceptés comme référence sans être déclarés dans le code.
const GLOBAL_VALUES = new Set([
  "undefined", "NaN", "Infinity", "globalThis",
  "Math", "JSON", "console", "Object", "Array", "String", "Number", "Boolean",
  "Date", "Symbol", "Promise", "Map", "Set", "RegExp", "Error",
  "parseInt", "parseFloat", "isNaN", "isFinite", "window", "document",
]);

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

type Tag =
  | "number"
  | "string"
  | "boolean"
  | "null"
  | "undefined"
  | "array"
  | "object"
  | "unknown";

/** Seuls ces tags sont « vérifiables » (on bloque sur un mismatch entre eux). */
const CHECKABLE = new Set<Tag>(["number", "string", "boolean"]);

/** Type annoté → tag comparable. */
function tagFromAnnotation(t: TypeAnnotation): Tag {
  switch (t.kind) {
    case "primitive":
      return t.name === "number" || t.name === "string" || t.name === "boolean"
        ? t.name
        : "unknown";
    case "literal-type":
      return typeof t.value === "number"
        ? "number"
        : typeof t.value === "string"
          ? "string"
          : "boolean";
    case "array":
    case "tuple":
      return "array";
    case "object":
      return "object";
    default:
      return "unknown"; // union, intersection, generic, reference, function
  }
}

/** Valeur structurée → tag inféré (best-effort). `lookup` résout les variables. */
function tagFromValue(v: Value, lookup: (name: string) => Tag, depth = 0): Tag {
  if (depth > 4) return "unknown";
  switch (v.kind) {
    case "literal": {
      const val = v.value;
      if (val === null) return "null";
      if (val === undefined) return "undefined";
      const tp = typeof val;
      return tp === "number" || tp === "string" || tp === "boolean" ? tp : "unknown";
    }
    case "variable":
      return lookup(v.name);
    case "template":
      return "string";
    case "array":
      return "array";
    case "object":
      return "object";
    case "unary":
      if (v.op === "!") return "boolean";
      if (v.op === "typeof") return "string";
      return v.op === "-" || v.op === "+" || v.op === "~" ? "number" : "unknown";
    case "binary": {
      const op = v.op;
      if (["===", "!==", "==", "!=", "<", ">", "<=", ">=", "instanceof", "in"].includes(op))
        return "boolean";
      if (["-", "*", "/", "%", "**", "&", "|", "^", "<<", ">>", ">>>"].includes(op))
        return "number";
      if (op === "+") {
        const l = tagFromValue(v.left, lookup, depth + 1);
        const r = tagFromValue(v.right, lookup, depth + 1);
        if (l === "string" || r === "string") return "string";
        if (l === "number" && r === "number") return "number";
        return "unknown";
      }
      return "unknown"; // &&, ||, ??
    }
    default:
      return "unknown"; // call, new, ternary, function, await, yield…
  }
}

/** Tag du type d'une variable nommée (annotation explicite, sinon init inféré). */
function nameTag(graph: GraphModel, name: string, depth = 0): Tag {
  if (depth > 4) return "unknown";
  for (const node of graph.nodes as TypedGraphNode[]) {
    const stmt = node.stmt as { kind?: string } | undefined;
    if (stmt?.kind !== "variable-declaration") continue;
    const decl = node.stmt as Extract<TypedGraphNode["stmt"], { kind: "variable-declaration" }>;
    for (const d of decl.declarations) {
      if (d.target.kind === "variable" && d.target.name === name) {
        if (d.type) return tagFromAnnotation(d.type);
        if (d.init) return tagFromValue(d.init, (n) => nameTag(graph, n, depth + 1), depth + 1);
        return "unknown";
      }
    }
  }
  return "unknown";
}

const LABEL: Record<Tag, string> = {
  number: "number",
  string: "string",
  boolean: "boolean",
  null: "null",
  undefined: "undefined",
  array: "tableau",
  object: "objet",
  unknown: "?",
};

/**
 * Message d'erreur pour la valeur d'une affectation, sinon `null` :
 *  1. une référence nue (identifiant) doit exister dans le code — sinon c'est
 *     probablement une chaîne sans guillemets ;
 *  2. son type doit correspondre à celui de la cible (primitifs connus, `=` seul).
 */
export function assignmentTypeError(
  graph: GraphModel,
  ast: File | null,
  operator: string,
  targetText: string,
  valueText: string,
): string | null {
  const target = targetText.trim();
  const value = valueText.trim();
  if (!target || !value) return null;

  const parsed = parseValue(value);

  // 1. Référence nue inexistante → très probablement une chaîne oubliée.
  if (parsed.kind === "variable") {
    const name = parsed.name;
    if (!GLOBAL_VALUES.has(name) && !allBindingNamesFromAst(ast).has(name)) {
      return `« ${name} » n'est pas défini. Pour une chaîne de caractères, utilisez des guillemets : "${name}".`;
    }
  }

  // 2. Compatibilité de type (affectation simple uniquement).
  if (operator !== "=") return null;
  const targetTag = nameTag(graph, target);
  if (!CHECKABLE.has(targetTag)) return null;
  const valueTag = tagFromValue(parsed, (n) => nameTag(graph, n));
  if (!CHECKABLE.has(valueTag)) return null;
  if (valueTag !== targetTag) {
    return `Type incompatible : ${LABEL[targetTag]} attendu, ${LABEL[valueTag]} fourni.`;
  }
  return null;
}

// --- Validation des expressions (conditions, en-têtes de boucle, switch) ------

/**
 * Erreur si une expression référence un identifiant qui n'existe pas dans le code.
 * On ne signale que des références « identifiant pur » (on ignore le contenu non
 * parsé, ex. `i++`, pour éviter les faux positifs). Les globaux sont tolérés.
 */
function referenceError(text: string, known: Set<string>): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const name of valueVars(parseValue(t))) {
    if (!IDENTIFIER.test(name)) continue; // pas un identifiant simple → ignoré
    if (GLOBAL_VALUES.has(name)) continue;
    if (!known.has(name)) return `« ${name} » n'est pas défini.`;
  }
  return null;
}

/** Valide chaque test de case d'un switch (« default » ignoré). */
function casesError(text: string, known: Set<string>): string | null {
  for (const part of text.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (part.toLowerCase() === "default") continue;
    const e = referenceError(part, known);
    if (e) return e;
  }
  return null;
}

/**
 * Erreurs de validation par champ pour un bloc, selon son `kind`. Couvre la
 * cohérence de l'affectation et l'existence des références dans les conditions,
 * en-têtes de boucle et switch. Clé = nom du champ `FormValues`.
 */
export function blockErrors(
  graph: GraphModel,
  ast: File | null,
  kind: BlockSpec["kind"],
  v: FormValues,
  anchor?: ScopeAnchor,
): Partial<Record<keyof FormValues, string>> {
  const errs: Partial<Record<keyof FormValues, string>> = {};
  // Portée stricte (déclaré avant + visible) si on a un point d'ancrage,
  // sinon existence globale (repli).
  const known =
    (anchor && namesInScope(graph, anchor)) || allBindingNamesFromAst(ast);
  const ref = (text: string) => referenceError(text, known);

  switch (kind) {
    case "assignment": {
      const e = assignmentTypeError(graph, ast, v.operator, v.targetText, v.valueText);
      if (e) errs.valueText = e;
      break;
    }
    case "if":
    case "while":
    case "do-while": {
      const e = ref(v.conditionText);
      if (e) errs.conditionText = e;
      break;
    }
    case "for": {
      // La variable de boucle est en portée dans test/update.
      const knownPlus = new Set(known);
      if (v.name.trim()) knownPlus.add(v.name.trim());
      const i = ref(v.initText);
      if (i) errs.initText = i;
      const t = referenceError(v.testText, knownPlus);
      if (t) errs.testText = t;
      const u = referenceError(v.updateText, knownPlus);
      if (u) errs.updateText = u;
      break;
    }
    case "for-of":
    case "for-in": {
      const e = ref(v.iterableText);
      if (e) errs.iterableText = e;
      break;
    }
    case "switch": {
      const d = ref(v.discriminantText);
      if (d) errs.discriminantText = d;
      const c = casesError(v.casesText, known);
      if (c) errs.casesText = c;
      break;
    }
  }
  return errs;
}
