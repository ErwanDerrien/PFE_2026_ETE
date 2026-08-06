import { Button } from '@astryxdesign/core/Button';
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
    <Button
      label={dirty ? `Synchroniser ${originLabel ?? ''}`.trim() : 'Synchronisé'}
      variant={dirty ? 'primary' : 'secondary'}
      size="sm"
      isDisabled={!dirty}
      onClick={sync}
      tooltip={
        dirty
          ? `Propager les modifications ${originLabel ?? ''} vers les autres vues`
          : 'Aucune modification à synchroniser'
      }
    />
  );
}
