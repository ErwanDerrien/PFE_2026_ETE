# /console — Console & exécution sandbox

**Propriétaire : Sous-équipe B (Justin, Erwan).**

> 📘 Nouveau sur le projet ou sur React ? Lisez d'abord [`docs/README.md`](../../../docs/README.md).

Exécute le code utilisateur en sandbox isolée, capture les sorties (`printMessage`,
`console.log`), affiche numéros de lignes et erreurs, propose des corrections.

## Comment s'intégrer

```ts
import { useAstStore } from '../sync';

// Code courant à exécuter (dérivé de l'AST source de vérité)
const source = useAstStore((s) => s.source);

// Erreurs de synchronisation à afficher dans la console
const error = useAstStore((s) => s.error);
```

## À faire
- Sandbox d'exécution isolée (iframe / Web Worker).
- API exposée au code utilisateur : `printMessage(...)`, `drawLine(...)`, callbacks souris.
- Fenêtre console : numéros de lignes, gestion d'erreurs, suggestions de correction.
