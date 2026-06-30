/**
 * BlockFields — champs de saisie d'un bloc, contrôlés et partagés entre le popup
 * de création (`BlockForm`) et la sidebar d'édition (`BlockSidebar`). Le parent
 * détient les valeurs (`FormValues`) ; ce composant ne fait que rendre les
 * champs du `kind` courant et remonter les changements via `onChange`.
 *
 * Les helpers `buildSpec`/`valuesFromSpec`/`isInvalid` font le pont avec
 * `BlockSpec` (le contrat de construction de node).
 */

import { useId, useMemo } from "react";
import { useAstStore } from "../../sync";
import { astTypeForKind, type BlockSpec } from "../node-create";
import { PRIMITIVE_TYPE_NAMES, namedTypesFromGraph } from "../type-options";
import {
  callableNames,
  namesInScope,
  reassignableInScope,
  reassignableNames,
  type ScopeAnchor,
} from "../scope-options";
import {
  ASSIGNMENT_OPERATORS,
  type AssignmentOperator,
  type DeclarationKind,
} from "../types/variable";
import type { TypedGraphNode } from "../typed-nodes";
import type { Statement, Value } from "../types/globalType";

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
  iterableText: string;
  discriminantText: string;
  casesText: string;
  paramsText: string;
  returnTypeText: string;
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
  iterableText: "",
  discriminantText: "",
  casesText: "",
  paramsText: "",
  returnTypeText: "",
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
    case "throw":
      return { kind: "throw", valueText: v.valueText };
    case "if":
      return { kind: "if", conditionText: v.conditionText };
    case "while":
      return { kind: "while", conditionText: v.conditionText };
    case "do-while":
      return { kind: "do-while", conditionText: v.conditionText };
    case "for":
      return {
        kind: "for",
        declarationKind: v.declarationKind,
        varName: v.name,
        initText: v.initText,
        testText: v.testText,
        updateText: v.updateText,
      };
    case "for-of":
      return {
        kind: "for-of",
        declarationKind: v.declarationKind,
        varName: v.name,
        iterableText: v.iterableText,
      };
    case "for-in":
      return {
        kind: "for-in",
        declarationKind: v.declarationKind,
        varName: v.name,
        iterableText: v.iterableText,
      };
    case "switch":
      return {
        kind: "switch",
        discriminantText: v.discriminantText,
        casesText: v.casesText,
      };
    case "function":
      return {
        kind: "function",
        name: v.name,
        paramsText: v.paramsText,
        returnTypeText: v.returnTypeText,
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
    case "throw":
      v.valueText = spec.valueText;
      break;
    case "if":
    case "while":
    case "do-while":
      v.conditionText = spec.conditionText;
      break;
    case "for":
      v.declarationKind = spec.declarationKind;
      v.name = spec.varName;
      v.initText = spec.initText ?? "";
      v.testText = spec.testText ?? "";
      v.updateText = spec.updateText ?? "";
      break;
    case "for-of":
    case "for-in":
      v.declarationKind = spec.declarationKind;
      v.name = spec.varName;
      v.iterableText = spec.iterableText;
      break;
    case "switch":
      v.discriminantText = spec.discriminantText;
      v.casesText = spec.casesText;
      break;
    case "function":
      v.name = spec.name;
      v.paramsText = spec.paramsText;
      v.returnTypeText = spec.returnTypeText ?? "";
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
    (kind === "throw" && !v.valueText.trim()) ||
    ((kind === "if" || kind === "while" || kind === "do-while") &&
      !v.conditionText.trim()) ||
    ((kind === "for-of" || kind === "for-in") &&
      (!v.name.trim() || !v.iterableText.trim())) ||
    (kind === "switch" && !v.discriminantText.trim()) ||
    (kind === "function" && !v.name.trim())
  );
}

interface Props {
  kind: BlockSpec["kind"];
  values: FormValues;
  onChange: (patch: Partial<FormValues>) => void;
  autoFocus?: boolean;
  /** Point d'ancrage pour la portée (cible d'affectation in-scope). */
  scopeAnchor?: ScopeAnchor;
  /** Messages d'erreur de validation par champ (clé = nom du champ). */
  errors?: Partial<Record<keyof FormValues, string>>;
}

export default function BlockFields({
  kind,
  values: v,
  onChange,
  autoFocus,
  scopeAnchor,
  errors,
}: Props) {
  const graph = useAstStore((s) => s.graph);
  const namedTypes = useMemo(() => namedTypesFromGraph(graph), [graph]);
  // Cible d'affectation : variables réassignables EN PORTÉE au point d'ancrage
  // (repli global si pas d'ancrage).
  const anchorKey = scopeAnchor ? JSON.stringify(scopeAnchor) : "";
  const targets = useMemo(
    () =>
      scopeAnchor
        ? reassignableInScope(graph, scopeAnchor)
        : reassignableNames(graph),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graph, anchorKey],
  );
  // Fonctions appelables depuis l'objet structuré (toutes : repliées, imbriquées,
  // et créées) — indépendant de l'AST.
  const callables = useMemo(() => callableNames(graph), [graph]);
  const curCallee = v.calleeText.trim();
  const extraCallee =
    curCallee && !callables.includes(curCallee) ? curCallee : null;
  // Conserve le type courant comme option s'il n'est ni primitif ni déclaré
  // (ex. un générique `Record<…>` venu de l'AST), pour ne pas le perdre à l'édition.
  const cur = v.typeText.trim();
  const extraType =
    cur &&
    !(PRIMITIVE_TYPE_NAMES as string[]).includes(cur) &&
    !namedTypes.includes(cur)
      ? cur
      : null;
  // Conserve la cible courante (ex. `obj.prop`, ou un nom hors scope collecté) si
  // elle n'est pas dans la liste des réassignables.
  const curTarget = v.targetText.trim();
  const extraTarget =
    curTarget && !targets.includes(curTarget) ? curTarget : null;

  // Property paths for object variables in scope (e.g. obj.prop, obj.nested.value).
  // Respects declaration order: only includes objects declared before the anchor.
  const scopeNames = useMemo(
    () => (scopeAnchor ? namesInScope(graph, scopeAnchor) : null),
    [graph, anchorKey],
  );

  const propertyPaths = useMemo(() => {
    const paths: string[] = [];
    const visited = new Set<string>();
    function collect(val: Value | undefined, prefix: string): void {
      if (!val) return;
      if (val.kind === "object") {
        for (const prop of val.properties) {
          const p = `${prefix}.${prop.key}`;
          if (!visited.has(p)) {
            visited.add(p);
            paths.push(p);
          }
          collect(prop.value, p);
        }
      } else if (val.kind === "array") {
        val.elements.forEach((el, i) => {
          if (!el || el.kind === "spread") return;
          const ip = `${prefix}[${i}]`;
          if (!visited.has(ip)) {
            visited.add(ip);
            paths.push(ip);
          }
          collect(el, ip);
        });
      }
    }
    for (const node of graph.nodes as TypedGraphNode[]) {
      const s = node.stmt as Statement | undefined;
      if (s?.kind === "variable-declaration") {
        const isConst = s.declarationKind === "const";
        for (const d of s.declarations) {
          if (d.target.kind === "variable" && d.init) {
            const name = d.target.name;
            // Only include if visible at the insertion point (or no anchor = global).
            if (scopeNames && !scopeNames.has(name)) continue;
            if (!isConst) {
              paths.push(name);
            }
            collect(d.init, name);
          }
        }
      }
    }
    return paths;
  }, [graph, scopeNames]);

  const datalistId = useId();

  if (kind === "break" || kind === "continue") {
    return (
      <div className="bf-empty">
        Aucun paramètre pour « {astTypeForKind(kind)} ».
      </div>
    );
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
              onChange={(e) =>
                onChange({ declarationKind: e.target.value as DeclarationKind })
              }
            >
              {DECLARATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
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
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </optgroup>
              {namedTypes.length > 0 && (
                <optgroup label="Types du code">
                  {namedTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
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
            <input
              autoFocus={autoFocus}
              className="bf-grow"
              value={v.targetText}
              onChange={(e) => onChange({ targetText: e.target.value })}
              placeholder="cible (ex. obj.prop)"
              list={datalistId}
            />
            <datalist id={datalistId}>
              {targets.map((n) => (
                <option key={n} value={n} />
              ))}
              {propertyPaths
                .filter((p) => !targets.includes(p))
                .map((p) => (
                  <option key={p} value={p} />
                ))}
              {extraTarget &&
                !targets.includes(extraTarget) &&
                !propertyPaths.includes(extraTarget) && (
                  <option value={extraTarget} />
                )}
            </datalist>
            <select
              value={v.operator}
              onChange={(e) =>
                onChange({ operator: e.target.value as AssignmentOperator })
              }
            >
              {ASSIGNMENT_OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
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
            {errors?.valueText && (
              <span className="bf-error">{errors.valueText}</span>
            )}
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
                <option key={n} value={n}>
                  {n}
                </option>
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

      {kind === "throw" && (
        <label className="bf-field">
          <span>valeur</span>
          <input
            autoFocus={autoFocus}
            value={v.valueText}
            onChange={(e) => onChange({ valueText: e.target.value })}
            placeholder='ex. new Error("…")'
          />
        </label>
      )}

      {(kind === "if" || kind === "while" || kind === "do-while") && (
        <label className="bf-field">
          <span>condition</span>
          <input
            autoFocus={autoFocus}
            value={v.conditionText}
            onChange={(e) => onChange({ conditionText: e.target.value })}
            placeholder="ex. score >= 90"
          />
          {errors?.conditionText && (
            <span className="bf-error">{errors.conditionText}</span>
          )}
        </label>
      )}

      {(kind === "for-of" || kind === "for-in") && (
        <>
          <div className="bf-row">
            <select
              value={v.declarationKind}
              onChange={(e) =>
                onChange({ declarationKind: e.target.value as DeclarationKind })
              }
            >
              {DECLARATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              autoFocus={autoFocus}
              className="bf-grow"
              value={v.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={kind === "for-of" ? "item" : "key"}
            />
          </div>
          <label className="bf-field">
            <span>{kind === "for-of" ? "itérable (of)" : "objet (in)"}</span>
            <input
              value={v.iterableText}
              onChange={(e) => onChange({ iterableText: e.target.value })}
              placeholder={kind === "for-of" ? "ex. items" : "ex. obj"}
            />
            {errors?.iterableText && (
              <span className="bf-error">{errors.iterableText}</span>
            )}
          </label>
        </>
      )}

      {kind === "for" && (
        <>
          <div className="bf-row">
            <select
              value={v.declarationKind}
              onChange={(e) =>
                onChange({ declarationKind: e.target.value as DeclarationKind })
              }
            >
              {DECLARATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
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
          {errors?.initText && (
            <span className="bf-error">{errors.initText}</span>
          )}
          <label className="bf-field">
            <span>condition (test)</span>
            <input
              value={v.testText}
              onChange={(e) => onChange({ testText: e.target.value })}
              placeholder="ex. i < n"
            />
            {errors?.testText && (
              <span className="bf-error">{errors.testText}</span>
            )}
          </label>
          <label className="bf-field">
            <span>incrément (update)</span>
            <input
              value={v.updateText}
              onChange={(e) => onChange({ updateText: e.target.value })}
              placeholder="ex. i++"
            />
            {errors?.updateText && (
              <span className="bf-error">{errors.updateText}</span>
            )}
          </label>
        </>
      )}

      {kind === "switch" && (
        <>
          <label className="bf-field">
            <span>expression (discriminant)</span>
            <input
              autoFocus={autoFocus}
              value={v.discriminantText}
              onChange={(e) => onChange({ discriminantText: e.target.value })}
              placeholder="ex. code"
            />
            {errors?.discriminantText && (
              <span className="bf-error">{errors.discriminantText}</span>
            )}
          </label>
          <label className="bf-field">
            <span>cas (séparés par , — « default » accepté)</span>
            <input
              value={v.casesText}
              onChange={(e) => onChange({ casesText: e.target.value })}
              placeholder="ex. 200, 404, default"
            />
            {errors?.casesText && (
              <span className="bf-error">{errors.casesText}</span>
            )}
          </label>
        </>
      )}

      {kind === "function" && (
        <>
          <label className="bf-field">
            <span>nom</span>
            <input
              autoFocus={autoFocus}
              value={v.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="ex. compute"
            />
          </label>
          <label className="bf-field">
            <span>paramètres (ex. a: number, b)</span>
            <input
              value={v.paramsText}
              onChange={(e) => onChange({ paramsText: e.target.value })}
              placeholder="a: number, b"
            />
          </label>
          <label className="bf-field">
            <span>type de retour (optionnel)</span>
            <input
              value={v.returnTypeText}
              onChange={(e) => onChange({ returnTypeText: e.target.value })}
              placeholder="ex. number"
            />
          </label>
        </>
      )}
    </>
  );
}
