# /editor — Éditeur de code (Monaco / CodeMirror)

**Propriétaire : Sous-équipe B (Justin, Erwan).**

> 📘 Nouveau sur le projet ou sur React ? Lisez d'abord [`docs/README.md`](../../../docs/README.md).

Intègre l'éditeur de code (coloration, autocomplétion, undo/redo) et le branche
sur le store partagé.

## Comment s'intégrer

```ts
import { useAstStore } from '../sync';

// Lecture : afficher le code dérivé de l'AST
const source = useAstStore((s) => s.source);
const lastOrigin = useAstStore((s) => s.lastOrigin);

// Écriture : à chaque frappe utilisateur
const setSource = useAstStore((s) => s.setSource);
setSource(newCode, 'editor');
```

> Astuce anti-boucle : si `lastOrigin === 'editor'`, ne pas réinjecter `source`
> dans l'éditeur (c'est votre propre modification).

## À faire
- Choisir Monaco ou CodeMirror et l'installer (non inclus dans le scaffold).
- Souligner les erreurs via `useAstStore((s) => s.error)` (`error.loc`).
