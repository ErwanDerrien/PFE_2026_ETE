/**
 * scope-options — listes de noms dérivées du code pour restreindre les saisies
 * (permissibilité). On ne tape pas un identifiant au hasard : on choisit parmi
 * ce qui existe réellement.
 *
 * Limite connue (phase visuelle) : collecte GLOBALE, sans analyse de portée fine
 * (une variable d'une autre fonction reste proposée). À raffiner avec un vrai
 * calcul de scope plus tard.
 */

import type { GraphModel, InsertTarget } from "../shared";
import { isLooping } from "./block-meta";
import type { TypedGraphNode } from "./typed-nodes";
import type { FunctionDeclaration } from "./types/function";
import type { Statement } from "./types/globalType";
import type { Parameter } from "./types/parameter";
import { declaredNames, patternNames } from "./var-refs";

/** Nom d'un paramètre simple (ignore la déstructuration pour l'instant). */
function simpleParamName(p: Parameter): string | null {
  switch (p.kind) {
    case "param":
    case "default-param":
    case "rest-param":
      return p.name;
    default:
      return null; // destructured-param
  }
}

/** Tous les noms liés par une liste de paramètres (gère la déstructuration). */
function paramNames(params: Parameter[]): string[] {
  return params.flatMap((p) =>
    p.kind === "destructured-param" ? patternNames(p.target) : [p.name],
  );
}

// --- Parcours récursif de l'OBJET STRUCTURÉ (jamais l'AST) -------------------
// Chaque node porte son `stmt` = le sous-arbre structuré COMPLET (même si le node
// est replié). On lit donc tout le code via les `stmt`, sans toucher à l'AST.

/** Descend dans les sous-blocs d'un statement structuré. */
function descend(stmt: Statement, walk: (stmts: Statement[]) => void): void {
  switch (stmt.kind) {
    case "function-declaration":
      walk(stmt.body.content);
      break;
    case "variable-declaration":
      for (const d of stmt.declarations) {
        if (d.init?.kind === "function" && "kind" in d.init.body && d.init.body.kind === "block") {
          walk(d.init.body.content); // corps d'une fonction fléchée/expression
        }
      }
      break;
    case "if":
      walk(stmt.then.content);
      if (stmt.else) walk(stmt.else.kind === "if" ? [stmt.else] : stmt.else.content);
      break;
    case "while":
    case "do-while":
    case "for":
    case "for-in":
    case "for-of":
      walk(stmt.body.content);
      break;
    case "try":
      walk(stmt.block.content);
      if (stmt.handler) walk(stmt.handler.body.content);
      if (stmt.finalizer) walk(stmt.finalizer.content);
      break;
    case "switch":
      for (const c of stmt.cases) walk(c.body);
      break;
  }
}

/** Visite tous les statements atteignables depuis les `stmt` des nodes (récursif). */
function visitAllStatements(graph: GraphModel, visit: (stmt: Statement) => void): void {
  const seen = new Set<Statement>();
  const walk = (stmts: Statement[]): void => {
    for (const s of stmts) {
      if (seen.has(s)) continue; // sous-arbre partagé déjà parcouru
      seen.add(s);
      visit(s);
      descend(s, walk);
    }
  };
  for (const node of graph.nodes as TypedGraphNode[]) {
    const s = node.stmt as Statement | undefined;
    if (s) walk([s]);
  }
}

/**
 * Fonctions appelables, depuis l'objet structuré : déclarations de fonction et
 * variables liées à une fonction. Le parcours récursif des `stmt` couvre les
 * fonctions imbriquées (même node parent replié) ET les fonctions CRÉÉES
 * (présentes dans le graphe mais pas dans l'AST).
 */
export function callableNames(graph: GraphModel): string[] {
  const names = new Set<string>();
  visitAllStatements(graph, (stmt) => {
    if (stmt.kind === "function-declaration") {
      if (stmt.name && stmt.name !== "<global>") names.add(stmt.name);
    } else if (stmt.kind === "variable-declaration") {
      for (const d of stmt.declarations) {
        if (d.init?.kind === "function" && d.target.kind === "variable") {
          names.add(d.target.name);
        }
      }
    }
  });
  return [...names].sort();
}

/**
 * Tous les noms LIÉS dans le code, depuis l'objet structuré : variables (tous
 * patterns), noms + paramètres de fonctions, variables de boucle, param de catch.
 * Sert à vérifier qu'une référence existe.
 */
export function allBindingNames(graph: GraphModel): Set<string> {
  const names = new Set<string>();
  visitAllStatements(graph, (stmt) => {
    switch (stmt.kind) {
      case "variable-declaration":
        for (const n of declaredNames(stmt)) names.add(n);
        for (const d of stmt.declarations) {
          if (d.init?.kind === "function") for (const n of paramNames(d.init.params)) names.add(n);
        }
        break;
      case "function-declaration":
        if (stmt.name) names.add(stmt.name);
        for (const n of paramNames(stmt.params)) names.add(n);
        break;
      case "for":
        if (stmt.init?.kind === "variable-declaration")
          for (const n of declaredNames(stmt.init)) names.add(n);
        break;
      case "for-of":
      case "for-in":
        if (stmt.left.kind === "variable-declaration")
          for (const n of declaredNames(stmt.left)) names.add(n);
        break;
      case "try":
        if (stmt.handler?.param) for (const n of patternNames(stmt.handler.param)) names.add(n);
        break;
    }
  });
  return names;
}

/**
 * Noms RÉASSIGNABLES déclarés dans le code : variables `let`/`var` (les `const`
 * sont exclus — non réassignables) et paramètres de fonction. Collecte GLOBALE
 * (sans portée) — sert de repli quand on n'a pas de point d'ancrage.
 */
export function reassignableNames(graph: GraphModel): string[] {
  const names = new Set<string>();
  for (const node of graph.nodes as TypedGraphNode[]) {
    const stmt = node.stmt as Statement | undefined;
    if (!stmt) continue;
    if (stmt.kind === "variable-declaration" && stmt.declarationKind !== "const") {
      for (const n of declaredNames(stmt)) names.add(n);
    } else if (stmt.kind === "function-declaration") {
      for (const p of (stmt as FunctionDeclaration).params) {
        const pn = simpleParamName(p);
        if (pn) names.add(pn);
      }
    }
  }
  return [...names].sort();
}

// --- Scope lexical pour la cible d'une affectation --------------------------
//
// Les ids de nodes sont path-based (`s/2/then/1`) : un statement a pour chemin
// `<blocPath>/<index>`, et un bloc imbriqué est `<statementPath>/<motclé>`
// (`/then`, `/else`, `/body`, `/try`, `/catch`, `/finally`, `/caseN`). On en
// déduit le nesting (= portée lexicale) et l'ordre (= « déclaré avant »).

/** Point d'ancrage d'où calculer la portée : un node existant (édition) ou une
 *  insertion (création). */
export type ScopeAnchor =
  | { kind: "node"; nodeId: string }
  | { kind: "insert"; target: InsertTarget };

/**
 * Un candidat (chemin `Pv`) est-il visible et déclaré AVANT le point `Pa` ?
 * Vrai si `Pv = B/k` avec `B` un bloc ancêtre de `Pa` et `k` antérieur à l'index
 * par lequel `Pa` traverse `B`. `inclusive` autorise le node d'ancrage lui-même
 * (insertion « après » ce node).
 */
function inScopeBefore(Pv: string, Pa: string, inclusive: boolean): boolean {
  if (Pv === Pa) return inclusive;
  const ls = Pv.lastIndexOf("/");
  if (ls < 0) return false;
  const block = Pv.slice(0, ls);
  const k = Number(Pv.slice(ls + 1));
  if (Number.isNaN(k)) return false; // pas un statement « simple » (ex. else-if)
  if (!Pa.startsWith(block + "/")) return false; // block doit être un préfixe-bloc de Pa
  const j = Number(Pa.slice(block.length + 1).split("/")[0]);
  if (Number.isNaN(j)) return false;
  return k < j;
}

/** Résout un ScopeAnchor en (chemin d'ancrage, inclusif du node d'ancrage). */
function resolveAnchor(
  graph: GraphModel,
  anchor: ScopeAnchor,
): { path: string; inclusive: boolean } | null {
  if (anchor.kind === "node") return { path: anchor.nodeId, inclusive: false };
  const t = anchor.target;
  if (t.kind === "port") return { path: t.nodeId, inclusive: true };
  if (t.kind === "edge") {
    // edge : le nouveau node se place après la source de l'arête.
    const edge = graph.edges.find((e) => e.id === t.edgeId);
    return edge ? { path: edge.source, inclusive: true } : null;
  }
  return null; // floating : aucune portée d'ancrage
}

/**
 * Contexte d'exécution au point d'insertion : est-on dans une boucle / un switch
 * englobant (sans franchir une frontière de fonction) ? Sert à n'autoriser
 * `continue` que dans une boucle et `break` que dans une boucle ou un switch.
 */
export function breakContinueAllowed(
  graph: GraphModel,
  target: InsertTarget,
): { break: boolean; continue: boolean } {
  if (target.kind === "floating") return { break: false, continue: false };

  const byId = new Map((graph.nodes as TypedGraphNode[]).map((n) => [n.id, n]));

  let startId: string;
  let includeStart: boolean; // le node de départ est-il un CONTENEUR du nouveau node ?
  if (target.kind === "port") {
    startId = target.nodeId;
    includeStart = target.port !== "exec-out"; // true/false/body → on entre dans ce node
  } else {
    const edge = graph.edges.find((e) => e.id === target.edgeId);
    if (!edge) return { break: false, continue: false };
    startId = edge.source;
    includeStart = edge.kind !== "exec"; // branche/corps → on entre dans la source
  }

  let loop = false;
  let sw = false;
  // Teste un node conteneur ; retourne true si on doit STOPPER (frontière de fonction).
  const test = (id: string): boolean => {
    const n = byId.get(id);
    if (!n) return false;
    if (n.role === "boundary") return true; // fonction : réinitialise le contexte
    if (isLooping(n.astType)) loop = true;
    else if (n.astType === "SwitchStatement") sw = true;
    return false;
  };

  if (includeStart && test(startId)) return { break: loop || sw, continue: loop };

  // Remonte les statements conteneurs via le chemin path-based.
  let path = startId;
  while (true) {
    const ls = path.lastIndexOf("/");
    if (ls < 0) break;
    const block = path.slice(0, ls); // retire l'index → chemin du bloc
    if (block === "s" || block === "") break; // bloc racine : plus de conteneur
    const ks = block.lastIndexOf("/");
    const container = block.slice(0, ks); // retire le mot-clé → statement conteneur
    if (test(container)) break;
    path = container;
  }

  return { break: loop || sw, continue: loop };
}

/**
 * Noms réassignables EN PORTÉE au point d'ancrage : variables `let`/`var`
 * déclarées avant dans le bloc courant ou un bloc ancêtre (closures incluses) +
 * paramètres des fonctions englobantes. Exclut `const`, les fonctions sœurs et
 * tout ce qui est déclaré plus tard.
 */
export function reassignableInScope(graph: GraphModel, anchor: ScopeAnchor): string[] {
  const resolved = resolveAnchor(graph, anchor);
  if (!resolved) return reassignableNames(graph); // repli prudent
  const { path: Pa, inclusive } = resolved;
  const names = new Set<string>();

  for (const node of graph.nodes as TypedGraphNode[]) {
    const stmt = node.stmt as Statement | undefined;
    if (!stmt) continue;

    // Variables let/var visibles et déclarées avant.
    if (stmt.kind === "variable-declaration" && stmt.declarationKind !== "const") {
      if (inScopeBefore(node.id, Pa, inclusive)) {
        for (const n of declaredNames(stmt)) names.add(n);
      }
    }

    // Paramètres d'une fonction englobante (son corps est un ancêtre de Pa).
    if (stmt.kind === "function-declaration") {
      const bodyBlock = `${node.id}/body`;
      if (Pa.startsWith(`${bodyBlock}/`)) {
        for (const p of (stmt as FunctionDeclaration).params) {
          const pn = simpleParamName(p);
          if (pn) names.add(pn);
        }
      }
    }
  }

  return [...names].sort();
}

/** Un bloc `Pf = B/k` est-il dans un bloc ancêtre de `Pa` (ordre ignoré) ? */
function inAncestorBlock(Pf: string, Pa: string): boolean {
  const ls = Pf.lastIndexOf("/");
  if (ls < 0) return false;
  const block = Pf.slice(0, ls);
  return Pa === Pf || Pa.startsWith(`${block}/`);
}

/**
 * TOUS les noms visibles ET déclarés avant le point d'ancrage : variables (tous
 * `kind`), paramètres des fonctions englobantes, fonctions déclarées dans un bloc
 * ancêtre (hoistées → ordre ignoré), et variables des boucles englobantes
 * (`for`/`for-of`/`for-in`). Sert à valider les références d'une expression.
 * Retourne `null` si l'ancrage est introuvable (le caller retombe sur l'existence
 * globale).
 */
export function namesInScope(graph: GraphModel, anchor: ScopeAnchor): Set<string> | null {
  const resolved = resolveAnchor(graph, anchor);
  if (!resolved) return null;
  const { path: Pa, inclusive } = resolved;
  const names = new Set<string>();

  for (const node of graph.nodes as TypedGraphNode[]) {
    const stmt = node.stmt as Statement | undefined;
    if (!stmt) continue;
    const Pf = node.id;

    if (stmt.kind === "variable-declaration") {
      if (inScopeBefore(Pf, Pa, inclusive)) {
        for (const n of declaredNames(stmt)) names.add(n);
      }
    } else if (stmt.kind === "function-declaration") {
      // Hoistée : visible dans tout bloc ancêtre, quel que soit l'ordre.
      if (inAncestorBlock(Pf, Pa)) names.add((stmt as FunctionDeclaration).name);
      // Paramètres d'une fonction englobante.
      if (Pa.startsWith(`${Pf}/body/`)) {
        for (const p of (stmt as FunctionDeclaration).params) {
          const pn = simpleParamName(p);
          if (pn) names.add(pn);
        }
      }
    } else if (stmt.kind === "for" || stmt.kind === "for-of" || stmt.kind === "for-in") {
      // Variable de boucle visible dans le corps de la boucle.
      const body = `${Pf}/body`;
      if (Pa === body || Pa.startsWith(`${body}/`)) {
        const decl = stmt.kind === "for" ? stmt.init : stmt.left;
        if (decl && decl.kind === "variable-declaration") {
          for (const n of declaredNames(decl)) names.add(n);
        }
      }
    }
  }

  return names;
}
