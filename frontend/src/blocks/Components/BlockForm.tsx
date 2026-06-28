/**
 * BlockForm — popup de CRÉATION pour les blocs qui demandent des champs. Détient
 * l'état des valeurs et délègue le rendu des champs à `BlockFields` (partagé avec
 * la sidebar d'édition). Produit un `BlockSpec` remonté à `BlocksCanvas`.
 */

import { type CSSProperties, useEffect, useState } from "react";
import { blockMeta } from "../block-meta";
import { astTypeForKind, type BlockSpec } from "../node-create";
import BlockFields, {
  EMPTY_VALUES,
  buildSpec,
  isInvalid,
  type FormValues,
} from "./BlockFields";

interface Props {
  kind: BlockSpec["kind"];
  x: number;
  y: number;
  onSubmit: (spec: BlockSpec) => void;
  onCancel: () => void;
}

export default function BlockForm({ kind, x, y, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const meta = blockMeta(astTypeForKind(kind), "statement");
  const invalid = isInvalid(kind, values);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    onSubmit(buildSpec(kind, values));
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

        <BlockFields
          kind={kind}
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          autoFocus
        />

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
