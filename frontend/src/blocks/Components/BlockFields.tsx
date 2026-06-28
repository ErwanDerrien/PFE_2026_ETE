/**
 * BlockFields — champs de saisie d'un bloc, contrôlés et partagés entre le popup
 * de création (`BlockForm`) et la sidebar d'édition (`BlockSidebar`). Le parent
 * détient les valeurs (`FormValues`) ; ce composant ne fait que rendre les
 * champs du `kind` courant et remonter les changements via `onChange`.
 *
 * Les helpers `buildSpec`/`valuesFromSpec`/`isInvalid` font le pont avec
 * `BlockSpec` (le contrat de construction de node).
 */

import { useMemo } from "react";
import { useAstStore } from "../../sync";
import { astTypeForKind, type BlockSpec } from "../node-create";
import { PRIMITIVE_TYPE_NAMES, namedTypesFromGraph } from "../type-options";
import { callableNamesFromAst, reassignableNames } from "../scope-options";
import {
  ASSIGNMENT_OPERATORS,
  type AssignmentOperator,
  type DeclarationKind,
} from "../types/variable";

/** État plat de tous les champs possibles (un sous-ensemble est utilisé par kind). */
export interface FormValues {
  name: string;
  declarationKind: DeclarationKind;
  typeText: string;
  initText: string;
  targetText: string;
  operator: AssignmentOperator;
  valueText: string;
  calleeText: string;
  argsText: string;
  returnValue: string;
  conditionText: string;
  testText: string;
  updateText: string;
}

export const EMPTY_VALUES: FormValues = {
  name: "",
  declarationKind: "const",
  typeText: "",
  initText: "",
  targetText: "",
  operator: "=",
  valueText: "",
  calleeText: "",
  argsText: "",
  returnValue: "",
  conditionText: "",
  testText: "",
  updateText: "",
};

const DECLARATION_KINDS: DeclarationKind[] = ["const", "let", "var"];

/** Valeurs de formulaire → `BlockSpec` (construction du node). */
export function buildSpec(kind: BlockSpec["kind"], v: FormValues): BlockSpec {
  switch (kind) {
    case "return":
      return { kind: "return", value: v.returnValue };
    case "break":
      return { kind: "break" };
    case "continue":
      return { kind: "continue" };
    case "variable":
      return {
        kind: "variable",
        declarationKind: v.declarationKind,
        name: v.name,
        typeText: v.typeText,
        initText: v.initText,
      };
    case "assignment":
      return {
        kind: "assignment",
        targetText: v.targetText,
        operator: v.operator,
        valueText: v.valueText,
      };
    case "call":
      return { kind: "call", calleeText: v.calleeText, argsText: v.argsText };
    case "if":
      return { kind: "if", conditionText: v.conditionText };
    case "while":
      return { kind: "while", conditionText: v.conditionText };
    case "for":
      return {
        kind: "for",
        declarationKind: v.declarationKind,
        varName: v.name,
        initText: v.initText,
        testText: v.testText,
        updateText: v.updateText,
      };
  }
}

/** `BlockSpec` → valeurs de formulaire (pré-remplissage de l'édition). */
export function valuesFromSpec(spec: BlockSpec): FormValues {
  const v = { ...EMPTY_VALUES };
  switch (spec.kind) {
    case "return":
      v.returnValue = spec.value ?? "";
      break;
    case "variable":
      v.declarationKind = spec.declarationKind;
      v.name = spec.name;
      v.typeText = spec.typeText ?? "";
      v.initText = spec.initText ?? "";
      break;
    case "assignment":
      v.targetText = spec.targetText;
      v.operator = spec.operator;
      v.valueText = spec.valueText;
      break;
    case "call":
      v.calleeText = spec.calleeText;
      v.argsText = spec.argsText;
      break;
    case "if":
    case "while":
      v.conditionText = spec.conditionText;
      break;
    case "for":
      v.declarationKind = spec.declarationKind;
      v.name = spec.varName;
      v.initText = spec.initText ?? "";
      v.testText = spec.testText ?? "";
      v.updateText = spec.updateText ?? "";
      break;
  }
  return v;
}

/** Champs requis manquants pour ce kind. */
export function isInvalid(kind: BlockSpec["kind"], v: FormValues): boolean {
  return (
    (kind === "variable" && !v.name.trim()) ||
    (kind === "assignment" && (!v.targetText.trim() || !v.valueText.trim())) ||
    (kind === "call" && !v.calleeText.trim()) ||
    ((kind === "if" || kind === "while") && !v.conditionText.trim())
  );
}

interface Props {
  kind: BlockSpec["kind"];
  values: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  autoFocus?: boolean;
}

export default function BlockFields({ kind, values: v, onChange, autoFocus }: Props) {
  const graph = useAstStore((s) => s.graph);
  const ast = useAstStore((s) => s.ast);
  const namedTypes = useMemo(() => namedTypesFromGraph(graph), [graph]);
  const targets = useMemo(() => reassignableNames(graph), [graph]);
  // Fonctions appelables depuis l'AST (toutes, indépendamment du repli des nodes).
  const callables = useMemo(() => callableNamesFromAst(ast), [ast]);
  const curCallee = v.calleeText.trim();
  const extraCallee = curCallee && !callables.includes(curCallee) ? curCallee : null;
  // Conserve le type courant comme option s'il n'est ni primitif ni déclaré
  // (ex. un générique `Record<…>` venu de l'AST), pour ne pas le perdre à l'édition.
  const cur = v.typeText.trim();
  const extraType =
    cur && !(PRIMITIVE_TYPE_NAMES as string[]).includes(cur) && !namedTypes.includes(cur)
      ? cur
      : null;
  // Conserve la cible courante (ex. `obj.prop`, ou un nom hors scope collecté) si
  // elle n'est pas dans la liste des réassignables.
  const curTarget = v.targetText.trim();
  const extraTarget = curTarget && !targets.includes(curTarget) ? curTarget : null;

  if (kind === "break" || kind === "continue") {
    return <div className="bf-empty">Aucun paramètre pour « {astTypeForKind(kind)} ».</div>;
  }

  return (
    <>
      {kind === "return" && (
        <label className="bf-field">
          <span>valeur (optionnel)</span>
          <input
            autoFocus={autoFocus}
            value={v.returnValue}
            onChange={(e) => onChange({ returnValue: e.target.value })}
            placeholder="ex. result"
          />
        </label>
      )}

      {kind === "variable" && (
        <>
          <div className="bf-row">
            <select
              value={v.declarationKind}
              onChange={(e) => onChange({ declarationKind: e.target.value as DeclarationKind })}
            >
              {DECLARATION_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <input
              autoFocus={autoFocus}
              className="bf-grow"
              value={v.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="nom"
            />
          </div>
          <label className="bf-field">
            <span>type (optionnel)</span>
            <select
              className="bf-fullwidth"
              value={v.typeText}
              onChange={(e) => onChange({ typeText: e.target.value })}
            >
              <option value="">(aucun)</option>
              <optgroup label="Primitifs">
                {PRIMITIVE_TYPE_NAMES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </optgroup>
              {namedTypes.length > 0 && (
                <optgroup label="Types du code">
                  {namedTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </optgroup>
              )}
              {extraType && (
                <optgroup label="Actuel">
                  <option value={extraType}>{extraType}</option>
                </optgroup>
              )}
            </select>
          </label>
          <label className="bf-field">
            <span>valeur initiale (optionnel)</span>
            <input
              value={v.initText}
              onChange={(e) => onChange({ initText: e.target.value })}
              placeholder="ex. a + b"
            />
          </label>
        </>
      )}

      {kind === "assignment" && (
        <>
          <div className="bf-row">
            <select
              autoFocus={autoFocus}
              className="bf-grow"
              value={v.targetText}
              onChange={(e) => onChange({ targetText: e.target.value })}
            >
              <option value="">cible…</option>
              {targets.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
              {extraTarget && (
                <optgroup label="Actuel">
                  <option value={extraTarget}>{extraTarget}</option>
                </optgroup>
              )}
            </select>
            <select
              value={v.operator}
              onChange={(e) => onChange({ operator: e.target.value as AssignmentOperator })}
            >
              {ASSIGNMENT_OPERATORS.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          <label className="bf-field">
            <span>valeur</span>
            <input
              value={v.valueText}
              onChange={(e) => onChange({ valueText: e.target.value })}
              placeholder="ex. a + 1"
            />
          </label>
        </>
      )}

      {kind === "call" && (
        <>
          <label className="bf-field">
            <span>fonction</span>
            <select
              autoFocus={autoFocus}
              className="bf-fullwidth"
              value={v.calleeText}
              onChange={(e) => onChange({ calleeText: e.target.value })}
            >
              <option value="">fonction…</option>
              {callables.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
              {extraCallee && (
                <optgroup label="Actuel">
                  <option value={extraCallee}>{extraCallee}</option>
                </optgroup>
              )}
            </select>
          </label>
          <label className="bf-field">
            <span>arguments (séparés par ,)</span>
            <input
              value={v.argsText}
              onChange={(e) => onChange({ argsText: e.target.value })}
              placeholder="ex. x, y, 42"
            />
          </label>
        </>
      )}

      {(kind === "if" || kind === "while") && (
        <label className="bf-field">
          <span>condition</span>
          <input
            autoFocus={autoFocus}
            value={v.conditionText}
            onChange={(e) => onChange({ conditionText: e.target.value })}
            placeholder="ex. score >= 90"
          />
        </label>
      )}

      {kind === "for" && (
        <>
          <div className="bf-row">
            <select
              value={v.declarationKind}
              onChange={(e) => onChange({ declarationKind: e.target.value as DeclarationKind })}
            >
              {DECLARATION_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <input
              autoFocus={autoFocus}
              className="bf-grow"
              value={v.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="i"
            />
            <input
              className="bf-grow"
              value={v.initText}
              onChange={(e) => onChange({ initText: e.target.value })}
              placeholder="= 0"
            />
          </div>
          <label className="bf-field">
            <span>condition (test)</span>
            <input
              value={v.testText}
              onChange={(e) => onChange({ testText: e.target.value })}
              placeholder="ex. i < n"
            />
          </label>
          <label className="bf-field">
            <span>incrément (update)</span>
            <input
              value={v.updateText}
              onChange={(e) => onChange({ updateText: e.target.value })}
              placeholder="ex. i++"
            />
          </label>
        </>
      )}
    </>
  );
}
