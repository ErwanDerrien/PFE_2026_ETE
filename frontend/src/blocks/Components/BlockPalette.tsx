/**
 * BlockPalette — popup listant les types de blocs ajoutables. Présentation pure :
 * elle remonte le `kind` choisi à `BlocksCanvas`, qui construit le node et appelle
 * le store. Position ancrée au point de clic (coordonnées écran).
 *
 * Permissibilité : `break`/`continue` sont désactivés hors d'un contexte valide
 * (boucle / switch), selon le point d'insertion.
 */

import { type CSSProperties, useEffect, useMemo } from "react";
import type { InsertTarget } from "../../shared";
import { useAstStore } from "../../sync";
import { blockMeta } from "../block-meta";
import { PALETTE_KINDS, astTypeForKind, paletteLabel, type BlockSpec } from "../node-create";
import { breakContinueAllowed } from "../scope-options";

interface Props {
  x: number;
  y: number;
  target: InsertTarget;
  onPick: (kind: BlockSpec["kind"]) => void;
  onClose: () => void;
}

export default function BlockPalette({ x, y, target, onPick, onClose }: Props) {
  const graph = useAstStore((s) => s.graph);
  const allowed = useMemo(() => breakContinueAllowed(graph, target), [graph, target]);

  // Fermeture au clavier (Échap).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const disabledReason = (kind: BlockSpec["kind"]): string | null => {
    if (kind === "continue" && !allowed.continue) return "Uniquement dans une boucle";
    if (kind === "break" && !allowed.break) return "Uniquement dans une boucle ou un switch";
    return null;
  };

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
            const meta = blockMeta(astTypeForKind(kind), "statement");
            const reason = disabledReason(kind);
            return (
              <button
                key={kind}
                type="button"
                className={`palette-item${reason ? " is-disabled" : ""}`}
                style={{ "--accent": meta.accent } as CSSProperties}
                disabled={!!reason}
                title={reason ?? undefined}
                onClick={() => onPick(kind)}
              >
                <span className="palette-icon">{meta.icon}</span>
                <span className="palette-label">{paletteLabel(kind, meta.label)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
