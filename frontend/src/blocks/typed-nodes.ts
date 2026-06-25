/**
 * TypedGraphNode — union discriminée de GraphNode par rôle sémantique.
 *
 * Chaque variant porte un champ `stmt` qui pointe directement vers l'objet
 * structuré (Statement ou Value) dont ce node est la projection visuelle.
 * Ce lien permet à l'éditeur de blocs de modifier le bon objet quand un
 * node est édité, sans avoir à naviguer l'arbre par chemin de chaîne.
 *
 * TypedGraphNode est un sous-type structurel de GraphNode (shared/graph.ts) :
 * chaque membre de l'union possède tous les champs de GraphNode plus `stmt`.
 * TypedGraphModel est donc assignable à GraphModel sans cast.
 */

import type { GraphEdge, NodeLevel, NodeTrack, SourceLoc } from "../shared";
import type { ExpressionStatement, Value } from "./types/globalType";
import type { FunctionDeclaration } from "./types/function";
import type { IfStatement } from "./types/ifStatement";
import type { InterfaceDeclaration } from "./types/interface";
import type {
  DoWhileStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  WhileStatement,
} from "./types/loops";
import type { ReturnStatement } from "./types/returnStatement";
import type {
  BreakStatement,
  ContinueStatement,
  SwitchStatement,
} from "./types/switch-case";
import type { ThrowStatement, TryStatement } from "./types/tryCatch";
import type { AssignmentExpression, VariableDeclaration } from "./types/variable";

interface BaseNode {
  id: string;
  track: NodeTrack;
  level: NodeLevel;
  label: string;
  source?: string;
  astType: string;
  astPath?: string;
  loc?: SourceLoc;
}

/** Définition de fonction — collapse/expand, corps déplié via arête `calls`. */
export interface BoundaryNode extends BaseNode {
  role: "boundary";
  stmt: FunctionDeclaration;
  collapsed: boolean;
}

/** Flux de contrôle : if / for / while / switch / try. */
export interface ControlNode extends BaseNode {
  role: "control";
  stmt:
    | IfStatement
    | WhileStatement
    | DoWhileStatement
    | ForStatement
    | ForInStatement
    | ForOfStatement
    | SwitchStatement
    | TryStatement;
}

/** Instruction simple : déclaration, affectation, return, throw, etc. */
export interface StatementNode extends BaseNode {
  role: "statement";
  stmt:
    | VariableDeclaration
    | AssignmentExpression
    | ReturnStatement
    | ExpressionStatement
    | BreakStatement
    | ContinueStatement
    | ThrowStatement
    | InterfaceDeclaration;
  members?: string[];
}

/** Expression composée dans le sous-arbre latéral (track expression, level 3). */
export interface ExprNode extends BaseNode {
  role: "expression";
  stmt: Value;
}

/** Feuille : littéral ou référence de variable. */
export interface LeafNode extends BaseNode {
  role: "literal";
  stmt: Value;
}

/** Union discriminée de tous les types de nœuds visuels. */
export type TypedGraphNode = BoundaryNode | ControlNode | StatementNode | ExprNode | LeafNode;

/** GraphModel avec nœuds typés — sous-type structurel de GraphModel. */
export interface TypedGraphModel {
  nodes: TypedGraphNode[];
  edges: GraphEdge[];
}
