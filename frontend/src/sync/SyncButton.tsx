/**
 * SyncButton — bouton GLOBAL de synchronisation entre les vues (équipe A).
 *
 * Monté dans la barre de navigation du shell. Désactivé tant qu'aucune
 * modification locale n'est en attente (`dirty`). Au clic, `sync()` propage la
 * vue émettrice (`lastOrigin`) vers les autres : la vue qui a fait la
 * modification ne re-render pas, ce sont les autres qui se mettent à jour.
 */

import { useAstStore } from "./store";
import "./sync-button.css";

/** Libellé de la vue émettrice, pour indiquer d'où partira la propagation. */
const ORIGIN_LABEL: Record<string, string> = {
  editor: "depuis l'éditeur",
  blocks: "depuis les blocs",
  "natural-lang": "depuis le langage naturel",
};

export default function SyncButton() {
  const dirty = useAstStore((s) => s.dirty);
  const lastOrigin = useAstStore((s) => s.lastOrigin);
  const sync = useAstStore((s) => s.sync);

  const originLabel = dirty && lastOrigin ? ORIGIN_LABEL[lastOrigin] : null;

  return (
    <button
      type="button"
      className={`sync-button${dirty ? " is-dirty" : ""}`}
      disabled={!dirty}
      onClick={sync}
      title={
        dirty
          ? `Propager les modifications ${originLabel ?? ""} vers les autres vues`
          : "Aucune modification à synchroniser"
      }
    >
      <span className="sync-button-icon">⟳</span>
      {dirty ? `Synchroniser ${originLabel ?? ""}` : "Synchronisé"}
    </button>
  );
}
