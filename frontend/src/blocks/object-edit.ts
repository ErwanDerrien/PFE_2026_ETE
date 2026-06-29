/**
 * object-edit — éditions de l'OBJET STRUCTURÉ (le `<global>` FunctionDeclaration),
 * désormais source de vérité des blocs. Chaque création/modification/suppression
 * mute l'objet ; le `graph` et l'AST/code en sont re-dérivés (objectToGraph /
 * convertObjectToAst / generate).
 *
 * Mapping cible → position : les ids de nodes sont path-based (`s/0/then/1`) et
 * encodent directement le chemin dans l'objet (bloc + index). On navigue donc
 * l'arbre via ces chemins.
 *
 * Fonctions PURES : on clone l'objet (structuredClone), on mute le clone, on le
 * renvoie (ou `null` si la cible est irrésolvable).
 */

import type { GraphModel, InsertTarget } from "../shared";
import type { FunctionDeclaration } from "./types/function";
import type { Block, Statement } from "./types/globalType";

type Root = FunctionDeclaration; // le `<global>`

/** Contenu d'un sous-bloc d'un statement selon le mot-clé de chemin. */
function subContent(stmt: Statement, kw: string): Statement[] | null {
  switch (kw) {
    case "then":
      return stmt.kind === "if" ? stmt.then.content : null;
    case "else":
      return stmt.kind === "if" && stmt.else && stmt.else.kind === "block"
        ? stmt.else.content
        : null;
    case "body":
      switch (stmt.kind) {
        case "while":
        case "do-while":
        case "for":
        case "for-in":
        case "for-of":
        case "function-declaration":
          return stmt.body.content;
        default:
          return null;
      }
    case "try":
      return stmt.kind === "try" ? stmt.block.content : null;
    case "catch":
      return stmt.kind === "try" && stmt.handler ? stmt.handler.body.content : null;
    case "finally":
      return stmt.kind === "try" && stmt.finalizer ? stmt.finalizer.content : null;
    default:
      if (kw.startsWith("case") && stmt.kind === "switch") {
        return stmt.cases[Number(kw.slice(4))]?.body ?? null;
      }
      return null;
  }
}

/** Contenu d'un bloc à partir de son chemin (`s`, `s/0/then`, `s/1/body`…). */
function blockContent(root: Root, blockPath: string): Statement[] | null {
  const segs = blockPath.split("/");
  if (segs[0] !== "s") return null;
  let content: Statement[] = root.body.content;
  for (let i = 1; i < segs.length; ) {
    const idx = Number(segs[i++]);
    if (Number.isNaN(idx)) return null;
    const stmt = content[idx];
    if (!stmt) return null;
    const kw = segs[i++];
    if (kw === undefined) return null; // chemin se terminant par un index → statement, pas bloc
    const sub = subContent(stmt, kw);
    if (!sub) return null;
    content = sub;
  }
  return content;
}

/** Conteneur + index d'un statement à partir de son chemin (`s/0/then/1`). */
function statementSlot(
  root: Root,
  path: string,
): { container: Statement[]; index: number } | null {
  const segs = path.split("/");
  const index = Number(segs[segs.length - 1]);
  if (Number.isNaN(index)) return null; // chemin non-statement (ex. else-if `…/else`)
  const container = blockContent(root, segs.slice(0, -1).join("/"));
  return container ? { container, index } : null;
}

/** Statement désigné par un chemin (ou null). */
function statementAt(root: Root, path: string): Statement | null {
  const slot = statementSlot(root, path);
  return slot ? (slot.container[slot.index] ?? null) : null;
}

const clone = (root: Root): Root =>
  structuredClone(root) as Root;

/**
 * Insère `stmt` dans l'objet selon la cible (arête scindée, port ouvert, libre).
 * Retourne le nouvel objet, ou `null` si la cible est irrésolvable.
 */
export function objectInsert(
  codeObj: Root,
  graph: GraphModel,
  target: InsertTarget,
  stmt: Statement,
): Root | null {
  const next = clone(codeObj);

  if (target.kind === "before") {
    const slot = statementSlot(next, target.nodeId);
    if (!slot) return null;
    slot.container.splice(slot.index, 0, stmt);
    return next;
  }

  if (target.kind === "floating") {
    if (stmt.kind === "function-declaration") {
      next.body.content.unshift(stmt);
    } else {
      next.body.content.push(stmt);
    }
    return next;
  }

  if (target.kind === "edge") {
    const edge = graph.edges.find((e) => e.id === target.edgeId);
    if (!edge) return null;
    // On insère à la position du node CIBLE (le nouveau devient son prédécesseur).
    const slot = statementSlot(next, edge.target);
    if (!slot) return null;
    slot.container.splice(slot.index, 0, stmt);
    return next;
  }

  // port
  if (target.port === "exec-out") {
    const slot = statementSlot(next, target.nodeId);
    if (!slot) return null;
    slot.container.splice(slot.index + 1, 0, stmt); // juste après le node
    return next;
  }

  const node = statementAt(next, target.nodeId);
  if (!node) return null;

  if (target.port === "true") {
    if (node.kind !== "if") return null;
    node.then.content.unshift(stmt);
    return next;
  }
  if (target.port === "false") {
    if (node.kind !== "if") return null;
    if (!node.else) node.else = { kind: "block", content: [] } as Block;
    if (node.else.kind === "if") return null; // else-if : non géré
    node.else.content.unshift(stmt);
    return next;
  }
  if (target.port === "body") {
    switch (node.kind) {
      case "while":
      case "do-while":
      case "for":
      case "for-in":
      case "for-of":
        node.body.content.unshift(stmt);
        return next;
      default:
        return null;
    }
  }
  return null;
}

/** Remplace le statement au chemin `nodePath` par `stmt`. */
export function objectUpdate(codeObj: Root, nodePath: string, stmt: Statement): Root | null {
  const next = clone(codeObj);
  const slot = statementSlot(next, nodePath);
  if (!slot || !slot.container[slot.index]) return null;
  slot.container[slot.index] = stmt;
  return next;
}

/** Supprime le statement au chemin `nodePath` (et tout son sous-arbre). */
export function objectDelete(codeObj: Root, nodePath: string): Root | null {
  const next = clone(codeObj);
  const slot = statementSlot(next, nodePath);
  if (!slot || !slot.container[slot.index]) return null;
  slot.container.splice(slot.index, 1);
  return next;
}
