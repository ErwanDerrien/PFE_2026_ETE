/**
 * BlockPalette — popup listant les types de blocs ajoutables. Présentation pure :
 * elle remonte le `kind` choisi à `BlocksCanvas`, qui construit le node et appelle
 * le store. Position ancrée au point de clic (coordonnées écran).
 */

import { type CSSProperties, useEffect } from "react";
import { blockMeta } from "../block-meta";
import { PALETTE_KINDS, type BlockSpec } from "../node-create";
import { STATEMENT_AST_TYPE, roleForStatement } from "../object-to-graph";

interface Props {
  x: number;
  y: number;
  onPick: (kind: BlockSpec["kind"]) => void;
  onClose: () => void;
}

export default function BlockPalette({ x, y, onPick, onClose }: Props) {
  // Fermeture au clavier (Échap).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div
        className="palette"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette-title">AJOUTER UN BLOC</div>
        <div className="palette-grid">
          {PALETTE_KINDS.map((kind) => {
            const astType = STATEMENT_AST_TYPE[kind] ?? kind;
            const meta = blockMeta(astType, roleForStatement(kind));
            return (
              <button
                key={kind}
                type="button"
                className="palette-item"
                style={{ "--accent": meta.accent } as CSSProperties}
                onClick={() => onPick(kind)}
              >
                <span className="palette-icon">{meta.icon}</span>
                <span className="palette-label">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
