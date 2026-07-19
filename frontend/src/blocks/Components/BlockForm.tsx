/**
 * BlockForm — popup de CRÉATION pour les blocs qui demandent des champs. Détient
 * l'état des valeurs et délègue le rendu des champs à `BlockFields` (partagé avec
 * la sidebar d'édition). Produit un `BlockSpec` remonté à `BlocksCanvas`.
 */

import { type CSSProperties, useEffect, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type { InsertTarget } from "../../shared";
import { useAstStore } from "../../sync";
import { blockMeta } from "../block-meta";
import { astTypeForKind, type BlockSpec } from "../node-create";
import { blockErrors } from "../type-check";
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
  target: InsertTarget;
  onSubmit: (spec: BlockSpec) => void;
  onCancel: () => void;
}

export default function BlockForm({ kind, x, y, target, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const graph = useAstStore((s) => s.graph);
  const meta = blockMeta(astTypeForKind(kind), "statement");
  const errors = blockErrors(graph, kind, values, { kind: "insert", target });
  const invalid = isInvalid(kind, values) || Object.keys(errors).length > 0;

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
          <span className="bf-icon">{meta.icon}</span>{" "}
          <Text type="label" weight="semibold">{meta.label}</Text>
        </div>

        <BlockFields
          kind={kind}
          values={values}
          onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          autoFocus
          scopeAnchor={{ kind: "insert", target }}
          errors={errors}
        />

        <HStack gap={1.5} hAlign="end">
          <Button label="Annuler" variant="ghost" size="sm" onClick={onCancel} />
          <Button label="Créer" variant="primary" size="sm" type="submit" isDisabled={invalid} />
        </HStack>
      </form>
    </div>
  );
}
