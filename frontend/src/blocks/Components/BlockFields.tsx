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
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { HStack, Stack } from "@astryxdesign/core/Stack";
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
      <Text type="supporting" size="sm" as="p">
        Aucun paramètre pour « {astTypeForKind(kind)} ».
      </Text>
    );
  }

  const err = (k: keyof FormValues) =>
    errors?.[k] ? { type: "error" as const, message: errors[k]! } : undefined;

  const KIND_OPTIONS = [...DECLARATION_KINDS];

  return (
    <Stack gap={2}>
      {kind === "return" && (
        <TextInput
          label="Valeur (optionnel)"
          size="sm"
          value={v.returnValue}
          onChange={(val: string) => onChange({ returnValue: val })}
          placeholder="ex. result"
        />
      )}

      {kind === "variable" && (
        <>
          <HStack gap={1.5} vAlign="end">
            <Selector
              label="Portée"
              size="sm"
              options={KIND_OPTIONS}
              value={v.declarationKind}
              onChange={(val: string) => onChange({ declarationKind: val as DeclarationKind })}
            />
            <TextInput
              label="Nom"
              size="sm"
              value={v.name}
              onChange={(val: string) => onChange({ name: val })}
              placeholder="nom"
            />
          </HStack>
          <Selector
            label="Type (optionnel)"
            size="sm"
            options={[
              "(aucun)",
              ...PRIMITIVE_TYPE_NAMES,
              ...namedTypes,
              ...(extraType ? [extraType] : []),
            ]}
            value={v.typeText || "(aucun)"}
            onChange={(val: string) => onChange({ typeText: val === "(aucun)" ? "" : val })}
          />
          <TextInput
            label="Valeur initiale (optionnel)"
            size="sm"
            value={v.initText}
            onChange={(val: string) => onChange({ initText: val })}
            placeholder="ex. a + b"
          />
        </>
      )}

      {kind === "assignment" && (
        <>
          <HStack gap={1.5} vAlign="end">
            {/* Saisie libre + suggestions de portée : datalist natif (pas d'équivalent
                Astryx sans source de recherche asynchrone). */}
            <label className="bf-field bf-grow">
              <Text type="label" size="xsm" color="secondary">Cible</Text>
              <input
                className="bf-native-input"
                autoFocus={autoFocus}
                value={v.targetText}
                onChange={(e) => onChange({ targetText: e.target.value })}
                placeholder="ex. obj.prop"
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
            </label>
            <Selector
              label="Opérateur"
              size="sm"
              options={[...ASSIGNMENT_OPERATORS]}
              value={v.operator}
              onChange={(val: string) => onChange({ operator: val as AssignmentOperator })}
            />
          </HStack>
          <TextInput
            label="Valeur"
            size="sm"
            value={v.valueText}
            onChange={(val: string) => onChange({ valueText: val })}
            placeholder="ex. a + 1"
            status={err("valueText")}
          />
        </>
      )}

      {kind === "call" && (
        <>
          <Selector
            label="Fonction"
            size="sm"
            placeholder="fonction…"
            options={[...callables, ...(extraCallee ? [extraCallee] : [])]}
            value={v.calleeText}
            onChange={(val: string) => onChange({ calleeText: val })}
          />
          <TextInput
            label="Arguments (séparés par ,)"
            size="sm"
            value={v.argsText}
            onChange={(val: string) => onChange({ argsText: val })}
            placeholder="ex. x, y, 42"
          />
        </>
      )}

      {kind === "throw" && (
        <TextInput
          label="Valeur"
          size="sm"
          value={v.valueText}
          onChange={(val: string) => onChange({ valueText: val })}
          placeholder='ex. new Error("…")'
        />
      )}

      {(kind === "if" || kind === "while" || kind === "do-while") && (
        <TextInput
          label="Condition"
          size="sm"
          value={v.conditionText}
          onChange={(val: string) => onChange({ conditionText: val })}
          placeholder="ex. score >= 90"
          status={err("conditionText")}
        />
      )}

      {(kind === "for-of" || kind === "for-in") && (
        <>
          <HStack gap={1.5} vAlign="end">
            <Selector
              label="Portée"
              size="sm"
              options={KIND_OPTIONS}
              value={v.declarationKind}
              onChange={(val: string) => onChange({ declarationKind: val as DeclarationKind })}
            />
            <TextInput
              label="Variable"
              size="sm"
              value={v.name}
              onChange={(val: string) => onChange({ name: val })}
              placeholder={kind === "for-of" ? "item" : "key"}
            />
          </HStack>
          <TextInput
            label={kind === "for-of" ? "Itérable (of)" : "Objet (in)"}
            size="sm"
            value={v.iterableText}
            onChange={(val: string) => onChange({ iterableText: val })}
            placeholder={kind === "for-of" ? "ex. items" : "ex. obj"}
            status={err("iterableText")}
          />
        </>
      )}

      {kind === "for" && (
        <>
          <HStack gap={1.5} vAlign="end">
            <Selector
              label="Portée"
              size="sm"
              options={KIND_OPTIONS}
              value={v.declarationKind}
              onChange={(val: string) => onChange({ declarationKind: val as DeclarationKind })}
            />
            <TextInput
              label="Variable"
              size="sm"
              value={v.name}
              onChange={(val: string) => onChange({ name: val })}
              placeholder="i"
            />
            <TextInput
              label="Init"
              size="sm"
              value={v.initText}
              onChange={(val: string) => onChange({ initText: val })}
              placeholder="= 0"
              status={err("initText")}
            />
          </HStack>
          <TextInput
            label="Condition (test)"
            size="sm"
            value={v.testText}
            onChange={(val: string) => onChange({ testText: val })}
            placeholder="ex. i < n"
            status={err("testText")}
          />
          <TextInput
            label="Incrément (update)"
            size="sm"
            value={v.updateText}
            onChange={(val: string) => onChange({ updateText: val })}
            placeholder="ex. i++"
            status={err("updateText")}
          />
        </>
      )}

      {kind === "switch" && (
        <>
          <TextInput
            label="Expression (discriminant)"
            size="sm"
            value={v.discriminantText}
            onChange={(val: string) => onChange({ discriminantText: val })}
            placeholder="ex. code"
            status={err("discriminantText")}
          />
          <TextInput
            label="Cas (séparés par , — « default » accepté)"
            size="sm"
            value={v.casesText}
            onChange={(val: string) => onChange({ casesText: val })}
            placeholder="ex. 200, 404, default"
            status={err("casesText")}
          />
        </>
      )}

      {kind === "function" && (
        <>
          <TextInput
            label="Nom"
            size="sm"
            value={v.name}
            onChange={(val: string) => onChange({ name: val })}
            placeholder="ex. compute"
          />
          <TextInput
            label="Paramètres (ex. a: number, b)"
            size="sm"
            value={v.paramsText}
            onChange={(val: string) => onChange({ paramsText: val })}
            placeholder="a: number, b"
          />
          <TextInput
            label="Type de retour (optionnel)"
            size="sm"
            value={v.returnTypeText}
            onChange={(val: string) => onChange({ returnTypeText: val })}
            placeholder="ex. number"
          />
        </>
      )}
    </Stack>
  );
}
