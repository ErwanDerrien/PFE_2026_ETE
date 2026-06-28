/**
 * BlockSidebar — panneau d'ÉDITION du node sélectionné (overlay à droite du
 * canvas). Pré-remplit les champs depuis le node (`specFromNode`), réutilise
 * `BlockFields`, et applique la modification via le store (`updateNode`).
 *
 * Les types non encore éditables (fonction, switch, try, interface, for-of…)
 * affichent un message en lecture seule.
 */

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useAstStore } from "../../sync";
import { blockMeta } from "../block-meta";
import { buildStatementNode, specFromNode } from "../node-create";
import type { TypedGraphNode } from "../typed-nodes";
import BlockFields, {
  EMPTY_VALUES,
  buildSpec,
  isInvalid,
  valuesFromSpec,
  type FormValues,
} from "./BlockFields";

interface Props {
  node: TypedGraphNode;
  onClose: () => void;
}

export default function BlockSidebar({ node, onClose }: Props) {
  const updateNode = useAstStore((s) => s.updateNode);
  const spec = useMemo(() => specFromNode(node), [node]);
  const meta = blockMeta(node.astType, node.role);

  const [values, setValues] = useState<FormValues>(() =>
    spec ? valuesFromSpec(spec) : EMPTY_VALUES,
  );

  // Ré-initialise les champs uniquement quand la SÉLECTION change (autre node),
  // pas à chaque re-dérivation du graphe (sinon on écraserait la saisie en cours).
  useEffect(() => {
    setValues(spec ? valuesFromSpec(spec) : EMPTY_VALUES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id]);

  const invalid = spec ? isInvalid(spec.kind, values) : true;

  const apply = () => {
    if (!spec || invalid) return;
    updateNode(node.id, buildStatementNode(buildSpec(spec.kind, values), node.id));
  };

  return (
    <aside className="block-sidebar" style={{ "--accent": meta.accent } as CSSProperties}>
      <header className="sidebar-head">
        <span className="sidebar-icon">{meta.icon}</span>
        <span className="sidebar-title">{meta.label}</span>
        <button type="button" className="sidebar-close" title="Fermer" onClick={onClose}>
          ×
        </button>
      </header>

      {spec ? (
        <div className="sidebar-body">
          <BlockFields
            kind={spec.kind}
            values={values}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
          />
          <div className="bf-actions">
            <button
              type="button"
              className="bf-btn bf-submit"
              disabled={invalid}
              onClick={apply}
            >
              Appliquer
            </button>
          </div>
        </div>
      ) : (
        <div className="sidebar-body">
          <p className="bf-empty">Ce type de bloc n'est pas encore éditable.</p>
          {node.source && <code className="sidebar-source">{node.source}</code>}
        </div>
      )}
    </aside>
  );
}
