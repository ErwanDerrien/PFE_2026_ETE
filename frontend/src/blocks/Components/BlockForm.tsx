/**
 * BlockForm — formulaire conditionnel pour les blocs qui demandent des champs
 * (variable / assignment / call / return). Produit un `BlockSpec` complet remonté
 * à `BlocksCanvas`, qui construit le node et appelle le store. Présentation pure.
 */

import { type CSSProperties, useEffect, useState } from "react";
import { blockMeta } from "../block-meta";
import { astTypeForKind, type BlockSpec } from "../node-create";
import {
  ASSIGNMENT_OPERATORS,
  type AssignmentOperator,
  type DeclarationKind,
} from "../types/variable";

interface Props {
  kind: BlockSpec["kind"];
  x: number;
  y: number;
  onSubmit: (spec: BlockSpec) => void;
  onCancel: () => void;
}

const DECLARATION_KINDS: DeclarationKind[] = ["const", "let", "var"];

export default function BlockForm({ kind, x, y, onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [declarationKind, setDeclarationKind] = useState<DeclarationKind>("const");
  const [typeText, setTypeText] = useState("");
  const [initText, setInitText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [operator, setOperator] = useState<AssignmentOperator>("=");
  const [valueText, setValueText] = useState("");
  const [calleeText, setCalleeText] = useState("");
  const [argsText, setArgsText] = useState("");
  const [returnValue, setReturnValue] = useState("");
  const [conditionText, setConditionText] = useState("");
  const [testText, setTestText] = useState("");
  const [updateText, setUpdateText] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const meta = blockMeta(astTypeForKind(kind), "statement");

  // Champs requis non remplis → bouton désactivé.
  const invalid =
    (kind === "variable" && !name.trim()) ||
    (kind === "assignment" && (!targetText.trim() || !valueText.trim())) ||
    (kind === "call" && !calleeText.trim()) ||
    ((kind === "if" || kind === "while") && !conditionText.trim());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    let spec: BlockSpec;
    switch (kind) {
      case "return":
        spec = { kind: "return", value: returnValue };
        break;
      case "variable":
        spec = { kind: "variable", declarationKind, name, typeText, initText };
        break;
      case "assignment":
        spec = { kind: "assignment", targetText, operator, valueText };
        break;
      case "call":
        spec = { kind: "call", calleeText, argsText };
        break;
      case "if":
        spec = { kind: "if", conditionText };
        break;
      case "while":
        spec = { kind: "while", conditionText };
        break;
      case "for":
        spec = { kind: "for", declarationKind, varName: name, initText, testText, updateText };
        break;
      default:
        return;
    }
    onSubmit(spec);
  };

  return (
    <div className="palette-backdrop" onClick={onCancel}>
      <form
        className="block-form"
        style={{ left: x, top: y, "--accent": meta.accent } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="palette-title">
          <span className="bf-icon">{meta.icon}</span> {meta.label}
        </div>

        {kind === "return" && (
          <label className="bf-field">
            <span>valeur (optionnel)</span>
            <input
              autoFocus
              value={returnValue}
              onChange={(e) => setReturnValue(e.target.value)}
              placeholder="ex. result"
            />
          </label>
        )}

        {kind === "variable" && (
          <>
            <div className="bf-row">
              <select
                value={declarationKind}
                onChange={(e) => setDeclarationKind(e.target.value as DeclarationKind)}
              >
                {DECLARATION_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <input
                autoFocus
                className="bf-grow"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="nom"
              />
            </div>
            <label className="bf-field">
              <span>type (optionnel)</span>
              <input
                value={typeText}
                onChange={(e) => setTypeText(e.target.value)}
                placeholder="ex. number"
              />
            </label>
            <label className="bf-field">
              <span>valeur initiale (optionnel)</span>
              <input
                value={initText}
                onChange={(e) => setInitText(e.target.value)}
                placeholder="ex. a + b"
              />
            </label>
          </>
        )}

        {kind === "assignment" && (
          <>
            <div className="bf-row">
              <input
                autoFocus
                className="bf-grow"
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                placeholder="cible (x, obj.prop)"
              />
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as AssignmentOperator)}
              >
                {ASSIGNMENT_OPERATORS.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
            <label className="bf-field">
              <span>valeur</span>
              <input
                value={valueText}
                onChange={(e) => setValueText(e.target.value)}
                placeholder="ex. a + 1"
              />
            </label>
          </>
        )}

        {kind === "call" && (
          <>
            <label className="bf-field">
              <span>fonction</span>
              <input
                autoFocus
                value={calleeText}
                onChange={(e) => setCalleeText(e.target.value)}
                placeholder="foo, obj.method"
              />
            </label>
            <label className="bf-field">
              <span>arguments (séparés par ,)</span>
              <input
                value={argsText}
                onChange={(e) => setArgsText(e.target.value)}
                placeholder="ex. x, y, 42"
              />
            </label>
          </>
        )}

        {(kind === "if" || kind === "while") && (
          <label className="bf-field">
            <span>condition</span>
            <input
              autoFocus
              value={conditionText}
              onChange={(e) => setConditionText(e.target.value)}
              placeholder="ex. score >= 90"
            />
          </label>
        )}

        {kind === "for" && (
          <>
            <div className="bf-row">
              <select
                value={declarationKind}
                onChange={(e) => setDeclarationKind(e.target.value as DeclarationKind)}
              >
                {DECLARATION_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <input
                autoFocus
                className="bf-grow"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="i"
              />
              <input
                className="bf-grow"
                value={initText}
                onChange={(e) => setInitText(e.target.value)}
                placeholder="= 0"
              />
            </div>
            <label className="bf-field">
              <span>condition (test)</span>
              <input
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="ex. i < n"
              />
            </label>
            <label className="bf-field">
              <span>incrément (update)</span>
              <input
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                placeholder="ex. i++"
              />
            </label>
          </>
        )}

        <div className="bf-actions">
          <button type="button" className="bf-btn bf-cancel" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="bf-btn bf-submit" disabled={invalid}>
            Créer
          </button>
        </div>
      </form>
    </div>
  );
}
