# /blocks — Blocs visuels (React Flow)

**Propriétaire : Sous-équipe A (Adel, Junior).**

> 📘 Nouveau sur le projet ou sur React ? Lisez d'abord [`docs/README.md`](../../../docs/README.md).

Rend le `GraphModel` (du store `/sync`) sous forme de nœuds/arêtes React Flow,
et gère l'édition par blocs (drag & drop, poignées typées).

## Comment s'intégrer

```ts
import { useAstStore } from '../sync';
import type { GraphModel } from '../shared';

// Lecture : s'abonner au graphe dérivé de l'AST
const graph = useAstStore((s) => s.graph);

// Écriture : pousser une édition de blocs -> graphToAst -> ast -> code
const applyGraphEdit = useAstStore((s) => s.applyGraphEdit);
applyGraphEdit(nextGraph, 'blocks');
```

## À faire
- Mapper `GraphNode` / `GraphEdge` (voir `/shared/graph.ts`) vers les types React Flow.
- Couleur par `role` (boundary/statement/control/expression/literal).
- Système à 3 niveaux (phases -> statements -> expressions) avec dépliage à la demande.
- Poignées typées (`HandleKind`) pour ne permettre que des connexions valides.

> Dépendances React Flow / dagre à installer par l'équipe A (non incluses dans le scaffold).
