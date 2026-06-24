/**
 * objectToGraph — convertit l'objet structuré produit par `traversePath`
 * (voir ./ast-mapping.ts) en `GraphModel` ({ nodes, edges }) — la projection
 * que React Flow rendra. Transformation PURE, sans dépendance UI.
 *
 * Premier jet : « spine + expressions, sans repli ».
 *  - Niveau 2 : un nœud par statement sur la colonne d'exécution (track `spine`),
 *    chaînés par des arêtes `exec` ; branches `branch-true`/`branch-false` pour
 *    if/switch ; sous-blocs `exec` pour boucles/try ; corps de fonction via `calls`.
 *  - Niveau 3 : sous-arbres d'expression (appels, binaires, …) en nœuds latéraux
 *    (track `expression`) reliés par des arêtes `expression`. Les feuilles
 *    (littéraux, variables) ne créent pas de nœud : elles sont résumées dans le
 *    `label`/`source` de leur parent.
 *
 * Raccourcis assumés : pas de refusion des branches (le statement suivant un `if`
 * repart du nœud `if`), pas de niveau 1 (regroupement par lignes vides), `loc` omis.
 */

import type {
  GraphEdge,
  GraphModel,
  GraphNode,
  GraphOptions,
  HandleKind,
  NodeLevel,
  NodeRole,
} from "../shared";
import { EMPTY_GRAPH } from "../shared";
import type { FunctionDeclaration, FunctionValue } from "./types/function";
import type { Block, Statement, Value } from "./types/globalType";
import type { IfStatement } from "./types/ifStatement";
import type { SwitchCase } from "./types/switch-case";
import type { Argument } from "./types/functionCall";
import type { Parameter } from "./types/parameter";
import type {
  AssignmentTarget,
  BindingTarget,
  Spread,
} from "./types/variable";

type Endpoints = {
  headId: string;
  tailId: string;
  // if-node IDs whose branch-false port has no target yet — connect to the next stmt in sequence
  openFalseBranches?: string[];
};

const BOUNDARY_KINDS = new Set(["function-declaration", "function"]);
const CONTROL_KINDS = new Set([
  "if",
  "switch",
  "while",
  "do-while",
  "for",
  "for-in",
  "for-of",
  "try",
]);

const STATEMENT_AST_TYPE: Record<string, string> = {
  "function-declaration": "FunctionDeclaration",
  function: "FunctionExpression",
  if: "IfStatement",
  switch: "SwitchStatement",
  while: "WhileStatement",
  "do-while": "DoWhileStatement",
  for: "ForStatement",
  "for-in": "ForInStatement",
  "for-of": "ForOfStatement",
  try: "TryStatement",
  "variable-declaration": "VariableDeclaration",
  assignment: "AssignmentExpression",
  return: "ReturnStatement",
  "expression-statement": "ExpressionStatement",
  break: "BreakStatement",
  continue: "ContinueStatement",
  "interface-declaration": "TSInterfaceDeclaration",
  throw: "ThrowStatement",
};

const VALUE_AST_TYPE: Record<string, string> = {
  literal: "Literal",
  variable: "Identifier",
  property: "MemberExpression",
  index: "MemberExpression",
  call: "CallExpression",
  new: "NewExpression",
  "tagged-template": "TaggedTemplateExpression",
  assignment: "AssignmentExpression",
  binary: "BinaryExpression",
  unary: "UnaryExpression",
  ternary: "ConditionalExpression",
  function: "ArrowFunctionExpression",
  array: "ArrayExpression",
  object: "ObjectExpression",
  template: "TemplateLiteral",
  await: "AwaitExpression",
  yield: "YieldExpression",
};

const isLeaf = (v: Value): boolean =>
  v.kind === "literal" || v.kind === "variable";

// Statements « définitions » : une déclaration de fonction est hoistée et une
// interface est purement type-level — aucune ne s'exécute au lancement. On les
// garde comme nœuds (définitions) mais hors de la chaîne d'exécution `exec`.
const NON_EXEC = new Set(["function-declaration", "interface-declaration"]);

// Nom racine de la valeur appelée pour tracer un lien `calls` vers sa définition :
// - foo(...)          → "foo"
// - obj.method(...)   → "obj"  (on lie l'appel à la variable contenant l'objet)
// - null si on ne peut pas résoudre statiquement
function directCalleeName(value: Value | undefined): string | null {
  if (!value || value.kind !== "call") return null;
  if (value.callee.kind === "variable") return value.callee.name;
  if (value.callee.kind === "property" && value.callee.object.kind === "variable")
    return value.callee.object.name;
  return null;
}

const roleForStatement = (kind: string): NodeRole => {
  if (BOUNDARY_KINDS.has(kind)) return "boundary";
  if (CONTROL_KINDS.has(kind)) return "control";
  return "statement";
};

const truncate = (text: string, max = 48): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const literalText = (value: string | number | boolean | null | undefined): string =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

const argValue = (arg: Argument): Value =>
  arg.kind === "spread-arg" ? arg.value : arg;

const elementValue = (el: Value | Spread): Value =>
  el.kind === "spread" ? el.value : el;

// Texte court reconstruit depuis l'objet structuré (sert aux labels et `source`).
function describe(v: Value): string {
  switch (v.kind) {
    case "literal":
      return literalText(v.value);
    case "variable":
      return v.name;
    case "property":
      return `${describe(v.object)}${v.optional ? "?." : "."}${v.property}`;
    case "index":
      return `${describe(v.object)}[${describe(v.index)}]`;
    case "call":
      return `${describe(v.callee)}(${v.args.map((a) => describe(argValue(a))).join(", ")})`;
    case "new":
      return `new ${describe(v.callee)}(${v.args.map((a) => describe(argValue(a))).join(", ")})`;
    case "binary":
      return `${describe(v.left)} ${v.op} ${describe(v.right)}`;
    case "unary":
      return `${v.op}${describe(v.value)}`;
    case "ternary":
      return `${describe(v.condition)} ? ${describe(v.then)} : ${describe(v.else)}`;
    case "array":
      return `[${v.elements.map((e) => (e ? describe(elementValue(e)) : "")).join(", ")}]`;
    case "object":
      return `{ ${v.properties.map((p) => `${p.key}: ${describe(p.value)}`).join(", ")} }`;
    case "template":
      return `\`${v.quasis
        .map((q, i) => q + (i < v.expressions.length ? `\${${describe(v.expressions[i])}}` : ""))
        .join("")}\``;
    case "await":
      return `await ${describe(v.value)}`;
    case "yield":
      return `yield${v.delegate ? "*" : ""}${v.value ? ` ${describe(v.value)}` : ""}`;
    case "assignment":
      return `${describeTarget(v.assignmentTargetName)} ${v.operator} ${describe(v.assignmentTargetValue)}`;
    case "function":
      return v.arrow ? "() => …" : `function ${v.name ?? ""}()`;
    case "tagged-template":
      return `${describe(v.tag)}\`…\``;
    default:
      return (v as { kind: string }).kind;
  }
}

function describeTarget(t: AssignmentTarget): string {
  switch (t.kind) {
    case "variable":
      return t.name;
    case "property":
      return `${describe(t.object)}.${t.property}`;
    case "index":
      return `${describe(t.object)}[${describe(t.index)}]`;
    case "array-destructure":
      return "[…]";
    case "object-destructure":
      return "{…}";
  }
}

function describeBinding(t: BindingTarget): string {
  switch (t.kind) {
    case "variable":
      return t.name;
    case "array-destructure":
      return "[…]";
    case "object-destructure":
      return "{…}";
  }
}

function describeParam(p: Parameter): string {
  switch (p.kind) {
    case "param":
      return p.name;
    case "default-param":
      return `${p.name} = ${describe(p.default)}`;
    case "rest-param":
      return `...${p.name}`;
    case "destructured-param":
      return p.target.kind === "array-destructure" ? "[…]" : "{…}";
  }
}

const describeParams = (params: Parameter[]): string =>
  params.map(describeParam).join(", ");

// Sous-valeurs d'une expression (pour la récursion niveau 3).
function childValues(v: Value, path: string): [string, Value][] {
  switch (v.kind) {
    case "binary":
      return [
        [`${path}/l`, v.left],
        [`${path}/r`, v.right],
      ];
    case "unary":
      return [[`${path}/v`, v.value]];
    case "ternary":
      return [
        [`${path}/c`, v.condition],
        [`${path}/t`, v.then],
        [`${path}/e`, v.else],
      ];
    case "property":
      return [[`${path}/o`, v.object]];
    case "index":
      return [
        [`${path}/o`, v.object],
        [`${path}/i`, v.index],
      ];
    case "call":
      return [
        [`${path}/fn`, v.callee],
        ...v.args.map((a, i): [string, Value] => [`${path}/a${i}`, argValue(a)]),
      ];
    case "new":
      return [
        [`${path}/fn`, v.callee],
        ...v.args.map((a, i): [string, Value] => [`${path}/a${i}`, argValue(a)]),
      ];
    case "tagged-template":
      return [
        [`${path}/tag`, v.tag],
        ...v.template.expressions.map((e, i): [string, Value] => [`${path}/x${i}`, e]),
      ];
    case "array":
      return v.elements.flatMap((el, i): [string, Value][] =>
        el ? [[`${path}/${i}`, elementValue(el)]] : [],
      );
    case "object":
      return v.properties.map((p, i): [string, Value] => [`${path}/p${i}`, p.value]);
    case "template":
      return v.expressions.map((e, i): [string, Value] => [`${path}/x${i}`, e]);
    case "await":
      return [[`${path}/v`, v.value]];
    case "yield":
      return v.value ? [[`${path}/v`, v.value]] : [];
    case "assignment":
      return [[`${path}/v`, v.assignmentTargetValue]];
    default:
      return []; // literal, variable, function
  }
}

function labelForStatement(stmt: Statement): string {
  switch (stmt.kind) {
    case "variable-declaration":
      return `${stmt.declarationKind} ${stmt.declarations.map((d) => describeBinding(d.target)).join(", ")}`;
    case "assignment":
      return `${describeTarget(stmt.assignmentTargetName)} ${stmt.operator}`;
    case "return":
      return "return";
    case "expression-statement":
      return truncate(describe(stmt.value));
    case "if":
      return "if";
    case "switch":
      return "switch";
    case "while":
      return "while";
    case "do-while":
      return "do…while";
    case "for":
      return "for";
    case "for-in":
      return "for…in";
    case "for-of":
      return "for…of";
    case "try":
      return "try";
    case "throw":
      return "throw";
    case "break":
      return stmt.label ? `break ${stmt.label}` : "break";
    case "continue":
      return stmt.label ? `continue ${stmt.label}` : "continue";
    case "function-declaration":
      return `function ${stmt.name}`;
    case "interface-declaration":
      return `interface ${stmt.name}`;
    default:
      return (stmt as { kind: string }).kind;
  }
}

function sourceForStatement(stmt: Statement): string | undefined {
  switch (stmt.kind) {
    case "variable-declaration":
      return truncate(
        `${stmt.declarationKind} ${stmt.declarations
          .map((d) => `${describeBinding(d.target)}${d.init ? ` = ${describe(d.init)}` : ""}`)
          .join(", ")}`,
        80,
      );
    case "assignment":
      return truncate(
        `${describeTarget(stmt.assignmentTargetName)} ${stmt.operator} ${describe(stmt.assignmentTargetValue)}`,
        80,
      );
    case "return":
      return stmt.value ? truncate(`return ${describe(stmt.value)}`, 80) : "return";
    case "throw":
      return truncate(`throw ${describe(stmt.value)}`, 80);
    case "expression-statement":
      return truncate(describe(stmt.value), 80);
    case "if":
      return truncate(`if (${describe(stmt.condition)}) {`, 80);
    case "while":
      return truncate(`while (${describe(stmt.condition)}) {`, 80);
    case "do-while":
      return truncate(`do { … } while (${describe(stmt.condition)})`, 80);
    case "switch":
      return truncate(`switch (${describe(stmt.discriminant)}) {`, 80);
    case "for": {
      const init = stmt.init
        ? stmt.init.kind === "variable-declaration"
          ? `${stmt.init.declarationKind} ${stmt.init.declarations
              .map((d) => `${describeBinding(d.target)}${d.init ? ` = ${describe(d.init)}` : ""}`)
              .join(", ")}`
          : describe(stmt.init)
        : "";
      const test = stmt.test ? describe(stmt.test) : "";
      const update = stmt.update ? describe(stmt.update) : "";
      return truncate(`for (${init}; ${test}; ${update}) {`, 80);
    }
    case "for-in":
    case "for-of": {
      const op = stmt.kind === "for-of" ? "of" : "in";
      const left =
        stmt.left.kind === "variable-declaration"
          ? `${stmt.left.declarationKind} ${stmt.left.declarations
              .map((d) => describeBinding(d.target))
              .join(", ")}`
          : describeTarget(stmt.left);
      return truncate(`for (${left} ${op} ${describe(stmt.right)}) {`, 80);
    }
    case "try":
      return "try {";
    case "function-declaration":
      return truncate(`function ${stmt.name}(${describeParams(stmt.params)}) {`, 80);
    default:
      return undefined;
  }
}

export function objectToGraph(
  mapping: Record<number, FunctionDeclaration | FunctionValue>,
  options: GraphOptions = {},
): GraphModel {
  const entries = Object.values(mapping);
  const root = entries.find((f) => f.name === "<global>") ?? entries[0];
  if (!root || !root.body || !("kind" in root.body) || root.body.kind !== "block") {
    return { ...EMPTY_GRAPH };
  }

  // Par défaut on n'émet PAS de nœuds d'expression séparés : l'expression est déjà
  // affichée en toutes lettres dans la ligne de code du statement. On peut les
  // réactiver explicitement via `options.collapseExpressions === false`.
  const collapseExpr = options.collapseExpressions !== false;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenIds = new Set<string>();
  let edgeSeq = 0;

  // Registre nom de fonction → id du nœud, et appels directs à relier après coup
  // (les fonctions sont hoistées : un appel peut précéder la déclaration).
  const funcRegistry = new Map<string, string>();
  const pendingCalls: { fromId: string; name: string }[] = [];
  const recordCall = (value: Value | undefined, fromId: string) => {
    const name = directCalleeName(value);
    if (name) pendingCalls.push({ fromId, name });
  };

  const uniqueId = (path: string): string => {
    let id = path;
    let i = 2;
    while (seenIds.has(id)) id = `${path}#${i++}`;
    seenIds.add(id);
    return id;
  };

  const emitNode = (
    path: string,
    fields: {
      role: NodeRole;
      track: GraphNode["track"];
      level: NodeLevel;
      label: string;
      astType: string;
      source?: string;
      collapsed?: boolean;
    },
  ): string => {
    const id = uniqueId(path);
    const node: GraphNode = {
      id,
      astPath: id,
      role: fields.role,
      track: fields.track,
      level: fields.level,
      label: fields.label,
      astType: fields.astType,
    };
    if (fields.source !== undefined) node.source = fields.source;
    if (fields.collapsed !== undefined) node.collapsed = fields.collapsed;
    nodes.push(node);
    return id;
  };

  const addEdge = (
    source: string,
    target: string,
    kind: GraphEdge["kind"],
    handles?: {
      sourceHandle?: HandleKind;
      targetHandle?: HandleKind;
      label?: string;
    },
  ): void => {
    const edge: GraphEdge = { id: `e${edgeSeq++}`, source, target, kind };
    if (handles?.sourceHandle) edge.sourceHandle = handles.sourceHandle;
    if (handles?.targetHandle) edge.targetHandle = handles.targetHandle;
    if (handles?.label) edge.label = handles.label;
    edges.push(edge);
  };

  // Émet un nœud d'expression et récurse dans ses sous-valeurs (compound only).
  const walkValue = (
    value: Value,
    parentId: string,
    path: string,
    sourceHandle: HandleKind = "args",
  ): string => {
    const label = truncate(describe(value));
    const id = emitNode(path, {
      role: isLeaf(value) ? "literal" : "expression",
      track: "expression",
      level: 3,
      label,
      astType: VALUE_AST_TYPE[value.kind] ?? value.kind,
      source: label,
    });
    addEdge(parentId, id, "expression", { sourceHandle, targetHandle: "value-out" });
    for (const [childPath, child] of childValues(value, path)) {
      if (isLeaf(child)) continue; // feuille résumée dans le label parent
      walkValue(child, id, childPath);
    }
    return id;
  };

  const maybeWalkValue = (value: Value, parentId: string, path: string): void => {
    if (collapseExpr || isLeaf(value)) return;
    walkValue(value, parentId, path);
  };

  // Relie un sous-bloc au nœud de contrôle parent (corps de boucle/try/fonction).
  // When expanding a function body (kind === "calls"), passes fromId so that
  // walkBlock can also add edges to any nested function declarations inside.
  const connectBlock = (
    block: Block,
    fromId: string,
    path: string,
    kind: GraphEdge["kind"],
    label?: string,
  ): void => {
    const containerFromId = kind === "calls" ? fromId : undefined;
    const ends = walkBlock(block.content, path, containerFromId);
    if (!ends) return;
    addEdge(fromId, ends.headId, kind, {
      sourceHandle: kind === "calls" ? "args" : "exec-out",
      targetHandle: "exec-in",
      label,
    });
  };

  // Connexion spécifique aux boucles : entre dans le corps via branch-true
  // ET ajoute une back-edge depuis la fin du corps vers le nœud de la boucle.
  const connectLoopBlock = (block: Block, loopId: string, path: string): void => {
    const ends = walkBlock(block.content, path);
    if (!ends) return;
    // Nœud boucle → premier statement du corps (BODY port)
    addEdge(loopId, ends.headId, "branch-true", {
      sourceHandle: "branch-true",
      targetHandle: "exec-in",
      label: "body",
    });
    // Dernier statement du corps → nœud boucle (back-edge)
    addEdge(ends.tailId, loopId, "loop-back", {
      sourceHandle: "exec-out",
      targetHandle: "exec-in",
      label: "↩",
    });
  };

  // Returns the list of if-node IDs whose branch-false port still needs connecting.
  const buildIf = (stmt: IfStatement, id: string, path: string): string[] => {
    maybeWalkValue(stmt.condition, id, `${path}/cond`);
    const thenEnds = walkBlock(stmt.then.content, `${path}/then`);
    if (thenEnds)
      addEdge(id, thenEnds.headId, "branch-true", {
        sourceHandle: "branch-true",
        targetHandle: "exec-in",
        label: "true",
      });
    if (stmt.else) {
      if (stmt.else.kind === "if") {
        const elseIf = walkStatement(stmt.else, `${path}/else`);
        addEdge(id, elseIf.headId, "branch-false", {
          sourceHandle: "branch-false",
          targetHandle: "exec-in",
          label: "else if",
        });
        // Propagate open false branches from the else-if chain
        return elseIf.openFalseBranches ?? [];
      } else {
        const elseEnds = walkBlock(stmt.else.content, `${path}/else`);
        if (elseEnds)
          addEdge(id, elseEnds.headId, "branch-false", {
            sourceHandle: "branch-false",
            targetHandle: "exec-in",
            label: "false",
          });
        return [];
      }
    }
    // No else: this if's FALSE port needs connecting to the continuation
    return [id];
  };

  const buildCase = (c: SwitchCase, id: string, path: string): void => {
    const ends = walkBlock(c.body, path);
    if (!ends) return; // case vide (fallthrough)
    addEdge(id, ends.headId, "branch-true", {
      sourceHandle: "branch-true",
      targetHandle: "exec-in",
      label: c.kind === "case" ? truncate(describe(c.test)) : "default",
    });
  };

  const walkStatement = (stmt: Statement, path: string): Endpoints => {
    const role = roleForStatement(stmt.kind);
    const level: NodeLevel = role === "boundary" ? 1 : 2;
    // Collapsed by default; expanded only when this exact path is in expandedFunctions.
    const isFuncDecl = stmt.kind === "function-declaration";
    const funcExpanded = isFuncDecl && (options.expandedFunctions?.has(path) ?? false);
    const id = emitNode(path, {
      role,
      track: "spine",
      level,
      label: labelForStatement(stmt),
      astType: STATEMENT_AST_TYPE[stmt.kind] ?? stmt.kind,
      source: sourceForStatement(stmt),
      ...(isFuncDecl ? { collapsed: !funcExpanded } : {}),
    });

    let openFalseBranches: string[] | undefined;
    switch (stmt.kind) {
      case "if": {
        const ob = buildIf(stmt, id, path);
        if (ob.length > 0) openFalseBranches = ob;
        break;
      }
      case "while":
      case "do-while":
        maybeWalkValue(stmt.condition, id, `${path}/cond`);
        connectLoopBlock(stmt.body, id, `${path}/body`);
        break;
      case "for":
        if (!collapseExpr) {
          if (stmt.init) {
            if (stmt.init.kind === "variable-declaration") {
              stmt.init.declarations.forEach((d, i) => {
                if (d.init) maybeWalkValue(d.init, id, `${path}/init${i}`);
              });
            } else {
              maybeWalkValue(stmt.init, id, `${path}/init`);
            }
          }
          if (stmt.test) maybeWalkValue(stmt.test, id, `${path}/test`);
          if (stmt.update) maybeWalkValue(stmt.update, id, `${path}/update`);
        }
        connectLoopBlock(stmt.body, id, `${path}/body`);
        break;
      case "for-in":
      case "for-of":
        maybeWalkValue(stmt.right, id, `${path}/right`);
        connectLoopBlock(stmt.body, id, `${path}/body`);
        break;
      case "switch":
        maybeWalkValue(stmt.discriminant, id, `${path}/disc`);
        stmt.cases.forEach((c, i) => buildCase(c, id, `${path}/case${i}`));
        break;
      case "try": {
        const tryEnds = walkBlock(stmt.block.content, `${path}/try`);
        if (tryEnds)
          addEdge(id, tryEnds.headId, "exec", {
            sourceHandle: "exec-out",
            targetHandle: "exec-in",
            label: "try",
          });
        if (stmt.handler) {
          const handlerEnds = walkBlock(stmt.handler.body.content, `${path}/catch`);
          if (handlerEnds)
            addEdge(id, handlerEnds.headId, "branch-false", {
              sourceHandle: "branch-false",
              targetHandle: "exec-in",
              label: stmt.handler.param
                ? `catch (${describeBinding(stmt.handler.param)})`
                : "catch",
            });
        }
        if (stmt.finalizer) {
          const finallyEnds = walkBlock(stmt.finalizer.content, `${path}/finally`);
          if (finallyEnds)
            addEdge(id, finallyEnds.headId, "exec", {
              sourceHandle: "exec-out",
              targetHandle: "exec-in",
              label: "finally",
            });
        }
        break;
      }
      case "function-declaration":
        funcRegistry.set(stmt.name, id);
        if (funcExpanded) connectBlock(stmt.body, id, `${path}/body`, "calls");
        break;
      case "variable-declaration":
        stmt.declarations.forEach((d, i) => {
          if (d.init) {
            maybeWalkValue(d.init, id, `${path}/d${i}`);
            recordCall(d.init, id);
          }
          if (d.target.kind === "variable") {
            const varName = d.target.name;
            if (d.init?.kind === "function") {
              // Arrow fn / fn expression: this node IS the definition.
              funcRegistry.set(varName, id);
            } else if (d.init?.kind === "call") {
              // The variable holds the result of calling something.
              // Resolve transitively so that callers of this variable trace back
              // to the originating function declaration (e.g. memoFib → memoize,
              // counter → makeCounter).
              const calledName = directCalleeName(d.init);
              const resolvedId = calledName ? funcRegistry.get(calledName) : undefined;
              funcRegistry.set(varName, resolvedId ?? id);
            } else {
              // Variable alias, object-destructure result, etc. — store the node
              // itself so obj.method() calls can still find the object definition.
              funcRegistry.set(varName, id);
            }
          }
        });
        break;
      case "assignment":
        maybeWalkValue(stmt.assignmentTargetValue, id, `${path}/val`);
        recordCall(stmt.assignmentTargetValue, id);
        break;
      case "return":
        if (stmt.value) {
          maybeWalkValue(stmt.value, id, `${path}/val`);
          recordCall(stmt.value, id);
        }
        break;
      case "expression-statement":
      case "throw":
        maybeWalkValue(stmt.value, id, `${path}/val`);
        recordCall(stmt.value, id);
        break;
      // break, continue, interface-declaration : aucun enfant à émettre
    }

    return openFalseBranches
      ? { headId: id, tailId: id, openFalseBranches }
      : { headId: id, tailId: id };
  };

  const walkBlock = (statements: Statement[], path: string, containerFromId?: string): Endpoints | null => {
    let firstHead: string | null = null;
    let prevTail: string | null = null;
    let prevOpenFalse: string[] = [];
    statements.forEach((stmt, i) => {
      const stmtPath = `${path}/${i}`;
      const ends = walkStatement(stmt, stmtPath);
      // Les définitions (fonction/interface) sont émises mais restent HORS du
      // flux d'exécution : on ne les chaîne pas en exec.
      if (NON_EXEC.has(stmt.kind)) {
        // When inside an expanded function body, add a calls edge from the
        // container function to each nested function declaration so it appears
        // connected in the layout rather than floating.
        if (stmt.kind === "function-declaration" && containerFromId) {
          addEdge(containerFromId, ends.headId, "calls", {
            sourceHandle: "args",
            targetHandle: "exec-in",
          });
        }
        return;
      }
      if (prevTail !== null) {
        addEdge(prevTail, ends.headId, "exec", {
          sourceHandle: "exec-out",
          targetHandle: "exec-in",
        });
        // Wire any dangling FALSE ports from the previous statement to this node
        for (const fromId of prevOpenFalse) {
          addEdge(fromId, ends.headId, "branch-false", {
            sourceHandle: "branch-false",
            targetHandle: "exec-in",
          });
        }
      } else {
        firstHead = ends.headId;
      }
      prevTail = ends.tailId;
      prevOpenFalse = ends.openFalseBranches ?? [];
    });
    if (firstHead === null || prevTail === null) return null;
    return {
      headId: firstHead,
      tailId: prevTail,
      ...(prevOpenFalse.length > 0 ? { openFalseBranches: prevOpenFalse } : {}),
    };
  };

  walkBlock(root.body.content, "s");

  // Relie chaque appel direct à la fonction qu'il invoque (arête `calls`).
  for (const { fromId, name } of pendingCalls) {
    const target = funcRegistry.get(name);
    if (target) {
      addEdge(fromId, target, "calls", {
        sourceHandle: "args",
        targetHandle: "exec-in",
        label: "calls",
      });
    }
  }

  return { nodes, edges };
}
