/**
 * SyncButton — bouton GLOBAL de synchronisation entre les vues (équipe A).
 *
 * Monté dans la TopNav du shell. Désactivé tant qu'aucune modification locale
 * n'est en attente (`dirty`). Au clic, `sync()` propage la vue émettrice
 * (`lastOrigin`) vers les autres : la vue qui a fait la modification ne
 * re-render pas, ce sont les autres qui se mettent à jour.
 *
 * UI : composants Astryx — Button (primary quand une sync est disponible) et
 * StatusDot pulsant qui attire l'œil sur l'état « modifications en attente ».
 */

import { Button } from "@astryxdesign/core/Button";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { HStack } from "@astryxdesign/core/Stack";
import { useAstStore } from "./store";

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
    <HStack gap={1.5} vAlign="center">
      <StatusDot
        variant={dirty ? "warning" : "success"}
        label={dirty ? "Modifications en attente" : "Vues synchronisées"}
        isPulsing={dirty}
      />
      <Button
        label={dirty ? `Synchroniser ${originLabel ?? ""}`.trim() : "Synchronisé"}
        variant={dirty ? "primary" : "ghost"}
        size="sm"
        isDisabled={!dirty}
        onClick={sync}
        tooltip={
          dirty
            ? `Propager les modifications ${originLabel ?? ""} vers les autres vues`
            : "Aucune modification à synchroniser"
        }
      />
    </HStack>
  );
}
