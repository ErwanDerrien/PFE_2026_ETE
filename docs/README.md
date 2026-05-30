# Guide complet du projet — pour tout le monde (même sans React)

> **À qui s'adresse ce document ?** À n'importe quel membre de l'équipe, y compris
> celles et ceux qui n'ont **jamais fait de React**. On part de zéro. Lisez-le de
> haut en bas une première fois ; ensuite servez-vous de la table des matières
> comme référence.

## Table des matières

1. [Le projet en une page](#1-le-projet-en-une-page)
2. [Le vocabulaire de base](#2-le-vocabulaire-de-base) (AST, parser, source de vérité…)
3. [React expliqué de zéro](#3-react-expliqué-de-zéro) (composant, JSX, rendu, état…)
4. [Qu'est-ce qu'un « hook » ?](#4-quest-ce-quun-hook)
5. [La gestion d'état globale avec Zustand](#5-la-gestion-détat-globale-avec-zustand)
6. [L'architecture du médiateur AST](#6-larchitecture-du-médiateur-ast) (le cœur du projet)
7. [La structure des types dans `/shared`](#7-la-structure-des-types-dans-shared) (en détail)
8. [Le dossier `/sync` : le store et les transformations](#8-le-dossier-sync--le-store-et-les-transformations)
9. [Comment MON équipe s'intègre](#9-comment-mon-équipe-sintègre)
10. [Structure des dossiers du dépôt](#10-structure-des-dossiers-du-dépôt)
11. [Démarrer et commandes utiles](#11-démarrer-et-commandes-utiles)
12. [Glossaire](#12-glossaire)
13. [FAQ](#13-faq)

---

## 1. Le projet en une page

On construit un **éditeur de code expérimental** où un même programme s'affiche en
**trois représentations** en même temps, toujours synchronisées :

| Représentation | Exemple | Équipe |
|---|---|---|
| **Code source** | `const x = 2 + 3;` | B (éditeur) |
| **Langage naturel** | « On crée une variable x qui vaut 2 + 3 » | Émie |
| **Blocs visuels** | un graphe de boîtes reliées par des flèches | A (blocs) |

Le but : si l'utilisateur modifie **une** représentation, les **deux autres** se
mettent à jour automatiquement.

Le défi : comment garder ces trois vues cohérentes ? On ne les relie pas deux à
deux (ça ferait 6 conversions). On passe par **un point central commun** : un
**AST** (voir section 2). Les trois vues sont des « traductions » de ce point
central. C'est ce qu'on appelle un **médiateur** ou une **source unique de
vérité**.

```
     Code  ⇄  ┌─────────────┐  ⇄  Blocs
              │   AST Babel  │
     NL    ⇄  │ (la vérité) │
              └─────────────┘
```

---

## 2. Le vocabulaire de base

Avant de parler de code, fixons 5 mots. Ils reviennent partout.

### AST (Abstract Syntax Tree = arbre syntaxique abstrait)
C'est une **représentation du code sous forme d'arbre**, comme un plan de
construction. Le texte `2 + 3` devient :

```
BinaryExpression (+)
├── left:  NumericLiteral (2)
└── right: NumericLiteral (3)
```

Pourquoi un arbre ? Parce qu'un programme est naturellement imbriqué : une fonction
contient des instructions, qui contiennent des expressions, qui contiennent
d'autres expressions… L'arbre capture exactement cette imbrication. Un ordinateur
manipule un arbre beaucoup plus facilement que du texte brut.

### Parser (analyseur syntaxique)
C'est l'outil qui **transforme du texte en AST**. On lui donne `"2 + 3"`, il rend
l'arbre ci-dessus. Dans notre projet, le parser s'appelle **Babel**
(`@babel/parser`). C'est une librairie standard du monde JavaScript.

### Generator (générateur)
L'inverse du parser : il **transforme un AST en texte**. On lui donne l'arbre, il
rend `"2 + 3"`. Chez nous c'est `@babel/generator`.

### Source de vérité (single source of truth)
La **donnée de référence** dont tout le reste découle. Dans notre app, c'est
**l'AST**. Le code affiché et les blocs affichés ne sont **pas** la vérité : ce
sont des **copies dérivées** (« projections ») recalculées à partir de l'AST. Si
deux choses ne sont pas d'accord, c'est l'AST qui a raison.

### Projection
Une **vue dérivée** de la source de vérité. Le code et les blocs sont des
projections de l'AST. On les régénère ; on ne les considère jamais comme la donnée
maîtresse.

> 🧠 **Image mentale.** L'AST est le **fichier original**. Le code et les blocs sont
> deux **photocopies** présentées différemment. Quand on modifie une photocopie, on
> remet d'abord à jour l'original (l'AST), puis on réimprime les photocopies.

---

## 3. React expliqué de zéro

Notre interface (frontend) est écrite avec **React**. Voici tout ce qu'il faut
comprendre pour lire le code, même sans expérience.

### 3.1 C'est quoi React ?
Une librairie pour construire des **interfaces** (boutons, panneaux, listes…). Son
idée centrale : on découpe l'écran en **composants** réutilisables, et React se
charge de **redessiner l'écran tout seul** quand les données changent. On ne
manipule pas le HTML à la main.

### 3.2 Un composant
Un composant est tout simplement **une fonction qui renvoie ce qu'il faut
afficher**. Par convention son nom commence par une majuscule.

```tsx
function Bonjour() {
  return <h1>Bonjour le monde</h1>;
}
```

Ce `<h1>…</h1>` à l'intérieur de JavaScript, c'est du **JSX**.

### 3.3 Le JSX
Le JSX est une syntaxe qui **mélange du HTML dans du JavaScript**. Ce n'est pas du
vrai HTML : c'est traduit en appels de fonctions. On peut y insérer des valeurs
JavaScript avec des accolades `{ }` :

```tsx
function Salut() {
  const prenom = "Adel";
  return <p>Salut {prenom} !</p>;   // affiche : Salut Adel !
}
```

### 3.4 Le rendu et le re-rendu (le concept le plus important)
- Le **rendu** = React appelle la fonction du composant pour savoir quoi afficher.
- Quand une donnée affichée change, React **rappelle la fonction** (re-rendu) et met
  à jour seulement ce qui a changé à l'écran.

👉 Conséquence cruciale : **la fonction d'un composant peut être exécutée des
dizaines de fois.** Elle doit donc rester « pure » (pas d'effet de bord surprise
au milieu). Pour mémoriser des choses entre deux rendus, on utilise les **hooks**
(section 4).

### 3.5 L'état (« state »)
L'**état**, c'est une **donnée qui peut changer et qui, quand elle change, déclenche
un re-rendu**. Exemple typique : un compteur.

```tsx
import { useState } from "react";

function Compteur() {
  const [valeur, setValeur] = useState(0); // valeur initiale : 0

  return (
    <button onClick={() => setValeur(valeur + 1)}>
      Cliqué {valeur} fois
    </button>
  );
}
```

- `useState(0)` crée un état initialisé à `0`.
- Il renvoie **deux choses** : la valeur actuelle (`valeur`) et une fonction pour la
  changer (`setValeur`).
- On ne fait **jamais** `valeur = valeur + 1` directement. On appelle
  `setValeur(...)`. C'est ce qui prévient React qu'il faut redessiner.

---

## 4. Qu'est-ce qu'un « hook » ?

Un **hook** est une **fonction spéciale de React dont le nom commence par `use`**
(`useState`, `useEffect`, et notre `useAstStore`). Un hook permet à un composant de
**« se brancher » sur une fonctionnalité de React** : garder un état, réagir à un
changement, s'abonner à des données partagées…

Pourquoi « hook » (= crochet, hameçon) ? Parce qu'on **accroche** le composant à un
mécanisme qui survit aux re-rendus. Sans hook, toute variable locale serait remise à
zéro à chaque re-rendu.

### Les 2 règles des hooks (à respecter absolument)
1. **On appelle les hooks uniquement tout en haut d'un composant** — jamais dans un
   `if`, une boucle, ou une fonction imbriquée.
2. **On appelle les hooks uniquement depuis un composant React** (ou depuis un autre
   hook), pas depuis du code ordinaire.

```tsx
function Exemple() {
  const [a, setA] = useState(0); // ✅ en haut, dans un composant
  if (a > 3) {
    const [b] = useState(0);     // ❌ interdit : dans un if
  }
}
```

> 🔑 **Retenez juste ça :** « un hook = une fonction `useXxx` qui donne à un
> composant l'accès à un état ou à des données qui survivent aux re-rendus. »
> Notre store partagé s'utilise via un hook : `useAstStore` (section 5).

---

## 5. La gestion d'état globale avec Zustand

### 5.1 Le problème
`useState` garde un état **dans un seul composant**. Mais notre AST doit être
**partagé par toute l'application** : l'éditeur, les blocs, le langage naturel et la
console doivent tous voir le **même** AST et réagir à ses changements. Faire passer
cette donnée de composant en composant à la main serait un cauchemar.

### 5.2 La solution : un « store » global
Un **store** est une **boîte de données partagée**, vivant en dehors des composants,
à laquelle n'importe quel composant peut s'abonner. On utilise la librairie
**Zustand** (toute petite, ~1 ko) car elle se marie parfaitement avec React Flow et
reste simple.

### 5.3 Notre store : `useAstStore`
Oui, c'est un **hook** (son nom commence par `use`). Il vit dans
[`frontend/src/sync/store.ts`](../frontend/src/sync/store.ts).

On l'utilise de deux façons :

**Lire une donnée** (en s'abonnant — le composant se redessine quand elle change) :

```tsx
import { useAstStore } from "../sync";

function MonPanneau() {
  // On lit UNIQUEMENT le morceau qui nous intéresse (un « sélecteur »).
  const code = useAstStore((s) => s.source);
  return <pre>{code}</pre>;
}
```

La fonction `(s) => s.source` s'appelle un **sélecteur** : elle dit « dans tout le
store `s`, je ne veux que `source` ». **Important :** en ne sélectionnant qu'un
petit morceau, votre composant ne se redessine que si **ce** morceau change (pas à
chaque changement du store). C'est meilleur pour les performances.

**Écrire une donnée** (en appelant une « action ») :

```tsx
function ChampDeSaisie() {
  const setSource = useAstStore((s) => s.setSource);

  return (
    <textarea
      onChange={(e) => setSource(e.target.value, "editor")}
    />
  );
}
```

Une **action** est une fonction fournie par le store qui **modifie** son contenu.
On ne modifie jamais le store « à la main » : on passe toujours par ses actions
(`setSource`, `applyGraphEdit`, `setLanguage`, `reset`). Ce sont elles qui
maintiennent la cohérence (voir section 6).

> 🧠 **Image mentale.** Le store est un **tableau blanc commun** au milieu de la
> pièce. Chaque équipe peut **lire** une zone du tableau (et est prévenue si on la
> modifie) et **écrire** uniquement via des marqueurs officiels (les actions) qui
> garantissent que le tableau reste cohérent.

---

## 6. L'architecture du médiateur AST

C'est le cœur du projet. Tout ce qui précède sert à comprendre cette section.

### 6.1 Les trois représentations tournent autour de l'AST
L'AST Babel est la **source de vérité**. Le code (`source`) et les blocs (`graph`)
sont des **projections** stockées à côté, recalculées à chaque modification.

### 6.2 Les quatre transformations
Pour relier l'AST aux représentations, il faut **quatre fonctions** (« transforms »).
Deux sont fournies gratuitement par Babel, deux sont le vrai travail de l'équipe A :

```
                        ┌──────────────────────────────┐
   code (texte) ──┐     │                              │     ┌── blocs (GraphModel)
                  │     │                              │     │
         parse()  ▼     │          AST Babel           │     ▼  astToGraph()
                  ────► │       (source de vérité)     │ ◄────
                  ◄──── │                              │ ────►
       generate() ▲     │                              │     ▲  graphToAst()
                  │     └──────────────────────────────┘     │
   code (texte) ──┘                                          └── blocs (GraphModel)
```

| Fonction | Direction | Fournie par | Difficulté |
|---|---|---|---|
| `parse` | code → AST | `@babel/parser` | facile ✅ |
| `generate` | AST → code | `@babel/generator` | facile ✅ |
| `astToGraph` | AST → blocs | **équipe A** | cœur (lecture) |
| `graphToAst` | blocs → AST | **équipe A** | cœur (le plus dur) |

Et le langage naturel ? Émie convertit **NL ↔ code** via l'API Claude, puis réinjecte
le code dans l'AST avec `parse`. Donc le NL passe par le code, qui passe par l'AST.

### 6.3 Le flux concret, étape par étape

**Quand l'utilisateur tape dans l'éditeur (équipe B) :**
1. L'éditeur appelle `setSource(nouveauCode, "editor")`.
2. Le store fait `parse(nouveauCode)` → nouvel AST (la vérité est mise à jour).
3. Le store fait `astToGraph(ast)` → nouveaux blocs.
4. Tous les composants abonnés à `graph` se redessinent → les blocs reflètent le code.

**Quand l'utilisateur déplace/édite un bloc (équipe A) :**
1. Les blocs appellent `applyGraphEdit(nouveauGraphe, "blocks")`.
2. Le store fait `graphToAst(graphe, astActuel)` → nouvel AST.
3. Le store fait `generate(ast)` → nouveau code.
4. Les composants abonnés à `source` se redessinent → l'éditeur reflète les blocs.

C'est exactement le câblage déjà présent dans
[`store.ts`](../frontend/src/sync/store.ts). Aujourd'hui les 4 transforms sont des
**stubs** (elles lèvent « non implémenté ») : le tuyau est posé, il reste à l'équipe
A à les remplir.

### 6.4 `lastOrigin` : éviter la boucle infinie
Danger classique : l'éditeur écrit → le store change → l'éditeur est notifié → il
réécrit → … boucle sans fin. Pour l'éviter, chaque écriture **étiquette son
origine** (`"editor"`, `"blocks"`, `"natural-lang"`, `"system"`) et le store retient
`lastOrigin`. Une vue peut alors **ignorer ses propres modifications** :

```tsx
const lastOrigin = useAstStore((s) => s.lastOrigin);
// Si c'est moi qui viens d'écrire, je ne me réécris pas.
if (lastOrigin !== "editor") {
  // ... synchroniser l'éditeur depuis le store
}
```

### 6.5 La gestion des erreurs
Si l'utilisateur tape du code invalide, `parse` échoue. Le store **n'explose pas** :
il attrape l'erreur et la range dans `error` (avec la **phase** où ça a cassé :
`parse`, `astToGraph`, `graphToAst` ou `generate`). La console (équipe B) et
l'éditeur peuvent lire `error` pour l'afficher.

---

## 7. La structure des types dans `/shared`

> 📁 [`frontend/src/shared`](../frontend/src/shared) — c'est le **contrat commun**.
> Tout le monde lit ces types ; personne n'y met de logique métier. Trois fichiers.

Petit rappel TypeScript : une **interface** ou un **type** décrit la **forme** d'une
donnée (quels champs, de quel type). Ça ne produit aucun code à l'exécution : c'est
purement une garantie vérifiée par le compilateur. Un `type X = 'a' | 'b'` veut dire
« X ne peut valoir que `'a'` ou `'b'` » (on appelle ça une **union**).

### 7.1 `graph.ts` — la description des blocs visuels

C'est le modèle des blocs, **volontairement indépendant de React Flow** (l'équipe A
le traduira vers React Flow au moment d'afficher). Les types clés :

- **`GraphModel`** — le graphe complet : `{ nodes: GraphNode[]; edges: GraphEdge[] }`.
  C'est ce que `astToGraph` produit et ce que les blocs affichent.

- **`GraphNode`** — une boîte. Champs importants :
  - `id` : identifiant unique de la boîte.
  - `role` : à quoi sert la boîte, sert à choisir sa **couleur**. Valeurs possibles
    (`NodeRole`) : `boundary` (fonction/bloc, violet), `statement` (instruction,
    sarcelle), `control` (if/for/while, ambre), `expression` (calcul, corail),
    `literal` (nombre/texte/nom, gris). 👉 On colore **par rôle, pas par type AST
    précis**, pour rester lisible.
  - `track` : `spine` (la boîte est sur la **colonne d'exécution principale**) ou
    `expression` (elle pend sur le côté comme un sous-calcul).
  - `level` : `1` = phases (résumé), `2` = instructions, `3` = détail d'une
    expression. On n'affiche le niveau suivant que lorsqu'on **déplie** une boîte
    (sinon l'écran serait surchargé).
  - `label` : texte lisible (« method call », « if branch »…).
  - `source` : le texte de code brut (utile quand la boîte est **repliée** en
    pastille).
  - `collapsed` : `true` si le sous-arbre est replié.
  - `astType` : le type Babel d'origine (ex. `"IfStatement"`), pour le debug.
  - `astPath`, `loc` : pour **retrouver** l'endroit correspondant dans l'AST/le code.
  - `data` : champ libre pour les besoins d'affichage de l'équipe A.

- **`GraphEdge`** — une flèche entre deux boîtes : `source` et `target` (les `id`),
  plus `kind` (`EdgeKind`) qui dit quel genre de flèche :
  - `exec` : « l'exécution continue ici » (flèche épaisse entre boîtes de la spine).
  - `expression` : « cette boîte évalue ce sous-calcul » (flèche fine, pointillés).
  - `branch-true` / `branch-false` : les deux sorties d'un `if`/ternaire.
  - `calls` : « appelle dans » (pour entrer dans le corps d'une fonction).

- **`HandleKind`** — les **points de branchement** d'une boîte (`exec-in`,
  `exec-out`, `args`, `value-out`, …). Ils servent à l'édition : on n'autorise que
  les connexions **compatibles**, pour que le graphe corresponde toujours à un
  programme valide.

- **`EMPTY_GRAPH`** — un graphe vide (`{ nodes: [], edges: [] }`), pratique comme
  valeur de départ.

### 7.2 `ast.ts` — la couche AST et le langage

- Réexporte les types Babel utiles (**`File`** = la racine de l'arbre, `Node`,
  `SourceLocation`) pour que personne n'ait à importer `@babel/types` directement.
- **`SupportedLanguage`** : `'typescript' | 'javascript'`. On commence par
  TypeScript (`DEFAULT_LANGUAGE`). Le multi-langage viendra plus tard (il suffira
  d'ajouter une entrée).
- **`LANGUAGE_CONFIG`** : les options à passer à Babel selon le langage (par ex. les
  plugins `['jsx', 'typescript']`). On y active `ranges` pour conserver les numéros
  de ligne — indispensable au regroupement et au lien code ↔ blocs.

### 7.3 `engine.ts` — le contrat du moteur

C'est le **contrat** que l'équipe A doit remplir et que tout le monde lit. Que des
types, aucune logique.

- Les **signatures des 4 transformations** : `Parse`, `Generate`, `AstToGraph`,
  `GraphToAst`, regroupées dans l'interface `SyncEngine`.
- **`GraphOptions`** : réglages de `astToGraph` (replier les expressions courtes,
  regrouper par lignes vides…).
- **`AstStoreState`** : la **forme du store** (section 8) — quelles données il
  contient et quelles actions il expose.
- **`EditOrigin`** : `'editor' | 'blocks' | 'natural-lang' | 'system'` (pour
  l'anti-boucle).
- **`SyncError`** + **`SyncPhase`** : la forme des erreurs et la phase où elles
  surviennent.

---

## 8. Le dossier `/sync` : le store et les transformations

> 📁 [`frontend/src/sync`](../frontend/src/sync) — propriété de l'équipe A, lu par
> tous. Deux fichiers + un point d'entrée.

### 8.1 `store.ts` — le store partagé
Crée `useAstStore` avec Zustand. Il contient l'état (`ast`, `source`, `graph`,
`language`, `error`, `lastOrigin`) et les actions (`setSource`, `applyGraphEdit`,
`setLanguage`, `reset`). Les actions enchaînent les transformations et **rangent les
erreurs** au lieu de planter. **Ce câblage est déjà complet** : dès que les
transforms seront implémentées, tout fonctionnera.

### 8.2 `transforms.ts` — les 4 fonctions (aujourd'hui en stub)
Chaque fonction a la **bonne signature** (importée du contrat) mais lève pour
l'instant `« … non implémenté — TODO équipe A »`. Le fichier contient des
commentaires indiquant comment chacune devra être écrite. C'est ici que l'équipe A
travaille en priorité.

### 8.3 `index.ts` — le point d'entrée
Réexporte `useAstStore` et les transforms pour que les autres équipes importent
proprement : `import { useAstStore } from "../sync";`.

---

## 9. Comment MON équipe s'intègre

Chaque dossier d'équipe a son propre `README.md` avec un exemple. Résumé :

| Vous êtes… | Vous lisez du store | Vous écrivez via | Origine à passer |
|---|---|---|---|
| **Éditeur (B)** | `s.source`, `s.error`, `s.lastOrigin` | `setSource(code, …)` | `"editor"` |
| **Console (B)** | `s.source`, `s.error` | — (exécute le code) | — |
| **Blocs (A)** | `s.graph` | `applyGraphEdit(graph, …)` | `"blocks"` |
| **Langage naturel (Émie)** | `s.source` | `setSource(code, …)` | `"natural-lang"` |
| **API Claude (Émie)** | — | — (appelle le backend) | — |

Règle d'or : **on lit l'état avec un sélecteur, on le modifie avec une action.**
Jamais autrement.

---

## 10. Structure des dossiers du dépôt

```
.
├── docs/                # CE guide
├── frontend/            # l'application web (Vite + React + TypeScript)
│   ├── index.html       # page HTML de départ
│   ├── package.json     # dépendances + scripts npm
│   └── src/
│       ├── main.tsx       # point d'entrée : monte l'app React dans la page
│       ├── shell/         # layout / assemblage de l'app   → tout le monde (sem. 1)
│       ├── shared/        # types & contrats communs        → tout le monde
│       ├── sync/          # store + transformations (vérité)→ équipe A
│       ├── blocks/        # blocs visuels (React Flow)       → équipe A
│       ├── editor/        # éditeur de code                  → équipe B
│       ├── console/       # console + exécution sandbox      → équipe B
│       ├── natural-lang/  # panneau langage naturel          → Émie
│       └── api/           # couche API Claude                → Émie
└── backend/             # proxy API Claude (node.js)
```

Pourquoi des dossiers par équipe ? Pour que chacun travaille **sans se marcher
dessus**, en se reposant uniquement sur les **contrats** de `/shared` et le **store**
de `/sync`.

---

## 11. Démarrer et commandes utiles

L'application vit dans `frontend/`. Depuis la racine du dépôt :

```bash
cd frontend
npm install     # installe les dépendances (à faire une fois, et après un git pull)
npm run dev     # lance le serveur de développement (ouvre http://localhost:5173)
npm run build   # vérifie les types (tsc) + construit la version de production
npm run lint    # vérifie le style/les erreurs avec ESLint
```

- **`npm run dev`** : le mode de travail quotidien. La page se recharge toute seule
  quand vous sauvegardez un fichier (HMR).
- **`npm run build`** doit **toujours passer** avant de pousser : il fait échouer la
  compilation à la moindre erreur de type. C'est notre filet de sécurité.

---

## 12. Glossaire

| Terme | Définition courte |
|---|---|
| **AST** | Arbre représentant la structure du code. Notre source de vérité. |
| **Parser** | Outil qui transforme du texte en AST (`@babel/parser`). |
| **Generator** | Outil qui transforme un AST en texte (`@babel/generator`). |
| **Babel** | La librairie qui fournit parser et generator pour JS/TS. |
| **Source de vérité** | La donnée de référence (l'AST) ; tout le reste en découle. |
| **Projection** | Vue dérivée de la source de vérité (le code, les blocs). |
| **Composant** | Une fonction React qui renvoie ce qu'il faut afficher (du JSX). |
| **JSX** | Syntaxe qui mêle « HTML » et JavaScript. |
| **Rendu / re-rendu** | React (r)appelle la fonction d'un composant pour (re)dessiner. |
| **État (state)** | Donnée qui, quand elle change, déclenche un re-rendu. |
| **Hook** | Fonction `useXxx` qui branche un composant sur un état/des données. |
| **Store** | Boîte de données partagée par toute l'app (ici via Zustand). |
| **Sélecteur** | Fonction `(s) => s.qqch` qui choisit le morceau du store à lire. |
| **Action** | Fonction du store qui modifie son contenu de façon contrôlée. |
| **Stub** | Fonction avec la bonne signature mais pas encore implémentée. |
| **TypeScript** | JavaScript avec des types vérifiés avant l'exécution. |
| **Interface / type** | Description de la forme d'une donnée (champs et types). |

---

## 13. FAQ

**Je ne connais pas React, par où je commence ?**
Sections 3, 4 et 5 de ce guide, dans l'ordre. Puis ouvrez
[`frontend/src/sync/store.ts`](../frontend/src/sync/store.ts) en lisant la section 8.

**Pourquoi l'AST est la source de vérité et pas le code ?**
Parce que les trois vues doivent rester cohérentes. Si chacune avait sa propre
version, elles divergeraient. En passant toutes par l'AST, on garantit qu'elles
parlent du même programme.

**Pourquoi les fonctions de `transforms.ts` lèvent une erreur ?**
Ce sont des **stubs** : le scaffold pose les contrats et le câblage, mais
l'implémentation (surtout `astToGraph` et `graphToAst`) est le travail de l'équipe A.
Le reste de l'app peut déjà être construit autour.

**Je veux afficher le code courant dans mon composant, comment ?**
```tsx
const code = useAstStore((s) => s.source);
```
Et il se mettra à jour tout seul quand l'AST changera.

**Je veux modifier le code/les blocs depuis mon composant, comment ?**
Avec une action : `setSource(nouveauCode, "...")` ou `applyGraphEdit(graph, "...")`.
Jamais en réassignant l'état à la main.

**C'est quoi React Flow / dagre dont parle le README des blocs ?**
React Flow est la librairie qui affiche les graphes de nœuds/flèches ; dagre
positionne automatiquement les nœuds. Ce sont des dépendances de l'équipe A, pas
encore installées (le scaffold reste minimal).

**Où poser une question d'architecture transverse ?**
Auprès de l'équipe A (responsable de `/sync` et de la source de vérité).
