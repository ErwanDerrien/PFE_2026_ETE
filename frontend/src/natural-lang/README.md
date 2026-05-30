# /natural-lang — Panneau langage naturel

**Propriétaire : Rôle transversal (Émie).**

> 📘 Nouveau sur le projet ou sur React ? Lisez d'abord [`docs/README.md`](../../../docs/README.md).

Affiche et édite la description en langage naturel du code. Convertit code ↔ NL
via l'API Claude (voir `/api`) et réconcilie avec le store partagé.

## Comment s'intégrer

```ts
import { useAstStore } from '../sync';

// Lecture du code à décrire
const source = useAstStore((s) => s.source);

// Après conversion NL -> code via Claude, réinjecter dans la source de vérité
const setSource = useAstStore((s) => s.setSource);
setSource(codeFromClaude, 'natural-lang');
```

## À faire
- Gérer les changements de texte « impact-less » (ne re-convertir que si le sens change).
- Le « défi difficile » de stabilité S -> D -> D' -> S' (round-trip).
- Régler la `temperature` de Claude pour des conversions stables.
