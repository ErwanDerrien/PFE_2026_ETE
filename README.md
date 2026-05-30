# PFE 2026 — IDE expérimental et multireprésentationnel

Une application web où un même bloc de code existe en **trois représentations
synchronisées** :

1. **Code source** (éditeur Monaco/CodeMirror)
2. **Langage naturel** (description générée via l'API Claude)
3. **Blocs visuels** (graphe React Flow)

Modifier une représentation met les deux autres à jour automatiquement. Le pont
entre elles est un **AST (Abstract Syntax Tree) Babel**, qui joue le rôle de
**source unique de vérité** / médiateur central.

## Architecture du médiateur AST

```
   code (string)  ──parse()──▶   AST Babel   ──astToGraph()──▶  blocs (GraphModel)
   code (string)  ◀─generate()─   (vérité)    ◀─graphToAst()──   blocs (GraphModel)
                                     ▲  │
                          langage naturel (via API Claude)
```

- **L'AST Babel est l'état canonique.** `source` (code) et `graph` (blocs) sont des
  *projections* recalculées à chaque écriture.
- Les vues **lisent** le store partagé et **écrivent** uniquement via ses actions,
  qui réconcilient systématiquement vers l'AST (anti-boucle via `lastOrigin`).
- TypeScript d'abord ; la couche langage est conçue pour devenir multi-langage.

Contrats dans [`frontend/src/shared`](frontend/src/shared) · moteur dans
[`frontend/src/sync`](frontend/src/sync).

## Structure du dépôt (monorepo)

```
.
├── frontend/            # application web (Vite + React + TS)
│   └── src/
│       ├── shell/         # layout / composition          → tout le monde (sem. 1)
│       ├── shared/        # types, interfaces, contrats    → tout le monde
│       ├── sync/          # moteur de sync (source vérité) → équipe A (Adel, Junior)
│       ├── blocks/        # blocs visuels (React Flow)     → équipe A
│       ├── editor/        # éditeur de code                → équipe B (Justin, Erwan)
│       ├── console/       # console + sandbox              → équipe B
│       ├── natural-lang/  # panneau langage naturel        → Émie (transversal)
│       └── api/           # couche API Claude              → Émie (transversal)
└── backend/             # proxy API Claude (node.js), voir backend/README.md
```

> 📘 **Nouveau sur le projet (ou sur React) ?** Lisez d'abord le guide complet :
> [`docs/README.md`](docs/README.md). Il explique tout depuis zéro (React, hooks,
> store, structure de l'AST) pour qu'un dev qui ne connaît pas React s'y retrouve.

## Démarrer

```bash
cd frontend
npm install
npm run dev      # serveur de dev Vite
npm run build    # tsc -b + build de production
npm run lint     # ESLint
```

## État actuel (branche `feat-ast`)

Scaffold + **contrats** posés. Les quatre transformations
(`parse` / `generate` / `astToGraph` / `graphToAst`) dans
[`frontend/src/sync/transforms.ts`](frontend/src/sync/transforms.ts) sont des
**stubs typés** : le câblage du store est complet, l'implémentation reste à faire
par l'équipe A. Chaque dossier d'équipe contient un `README.md` expliquant comment
s'intégrer au store partagé.
