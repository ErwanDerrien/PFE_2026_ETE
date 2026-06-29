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
  GraphOptions,
  HandleKind,
  NodeLevel,
  NodeRole,
} from "../shared";
import type { TypedGraphModel, TypedGraphNode } from "./typed-nodes";
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
  TypeAnnotation,
} from "./types/variable";
import type { InterfaceDeclaration, InterfaceMember } from "./types/interface";

type Endpoints = {
  headId: string;
  tailId: string;
  // if-node IDs whose branch-false port has no target yet — connect to the next stmt in sequence
  openFalseBranches?: string[];
  // node IDs whose exec-out port has no target yet (try/catch tails) — connect to the next stmt
  openExecTails?: string[];
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

export const STATEMENT_AST_TYPE: Record<string, string> = {
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

// Returns the FunctionValue init if the statement is a single-declaration
// variable-declaration whose initialiser is a function/arrow (e.g. `const f = () => {}`).
// These are treated as function boundaries: boundary role, collapsible, body-expandable.
function getFuncVarInit(stmt: Statement): FunctionValue | null {
  if (stmt.kind !== "variable-declaration" || stmt.declarations.length !== 1) return null;
  const init = stmt.declarations[0].init;
  return init?.kind === "function" ? (init as FunctionValue) : null;
}

// True if a block ends with an abrupt completion (`throw` / `return`). Such a
// path does NOT fall through to the next statement: after running `finally`,
// control leaves the try (the exception/return propagates) rather than
// continuing the sequence.
function endsAbruptly(statements: Statement[]): boolean {
  const last = statements[statements.length - 1];
  return last?.kind === "throw" || last?.kind === "return";
}

// Nom racine de la valeur appelée pour tracer un lien `calls` vers sa définition :
// - foo(...)          → "foo"
// - obj.method(...)   → "obj"  (on lie l'appel à la variable contenant l'objet)
// - null si on ne peut pas résoudre statiquement
export function directCalleeName(value: Value | undefined): string | null {
  if (!value || value.kind !== "call") return null;
  if (value.callee.kind === "variable") return value.callee.name;
  if (
    value.callee.kind === "property" &&
    value.callee.object.kind === "variable"
  )
    return value.callee.object.name;
  return null;
}

export const roleForStatement = (kind: string): NodeRole => {
  if (BOUNDARY_KINDS.has(kind)) return "boundary";
  if (CONTROL_KINDS.has(kind)) return "control";
  return "statement";
};

const truncate = (text: string, max = 48): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const literalText = (
  value: string | number | boolean | null | undefined,
): string =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

const argValue = (arg: Argument): Value =>
  arg.kind === "spread-arg" ? arg.value : arg;

const elementValue = (el: Value | Spread): Value =>
  el.kind === "spread" ? el.value : el;

// Texte court reconstruit depuis l'objet structuré (sert aux labels et `source`).
export function describe(v: Value): string {
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
        .map(
          (q, i) =>
            q +
            (i < v.expressions.length
              ? `\${${describe(v.expressions[i])}}`
              : ""),
        )
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

export function describeTarget(t: AssignmentTarget): string {
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

export function describeBinding(t: BindingTarget): string {
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

export const describeParams = (params: Parameter[]): string =>
  params.map(describeParam).join(", ");

export function describeType(t: TypeAnnotation): string {
  switch (t.kind) {
    case "primitive":
      return t.name;
    case "literal-type":
      return String(t.value);
    case "union":
      return t.members.map(describeType).join(" | ");
    case "intersection":
      return t.members.map(describeType).join(" & ");
    case "array":
      return `${describeType(t.element)}[]`;
    case "tuple":
      return `[${t.elements.map(describeType).join(", ")}]`;
    case "object":
      return `{ ${t.properties.map((p) => `${p.key}${p.optional ? "?" : ""}: ${describeType(p.value)}`).join("; ")} }`;
    case "function":
      return `(${t.params.map((p) => `${p.name}: ${describeType(p.type)}`).join(", ")}) => ${describeType(t.returns)}`;
    case "generic":
      return `${describeType(t.base)}<${t.args.map(describeType).join(", ")}>`;
    case "type-reference":
      return t.name;
  }
}

/** Collects all named type-reference strings from a TypeAnnotation (recursive). */
function typeRefNames(t: TypeAnnotation): string[] {
  switch (t.kind) {
    case "type-reference":
      return [t.name];
    case "union":
      return t.members.flatMap(typeRefNames);
    case "intersection":
      return t.members.flatMap(typeRefNames);
    case "array":
      return typeRefNames(t.element);
    case "tuple":
      return t.elements.flatMap(typeRefNames);
    case "generic":
      return [...typeRefNames(t.base), ...t.args.flatMap(typeRefNames)];
    case "object":
      return t.properties.flatMap((p) => typeRefNames(p.value));
    case "function":
      return [
        ...t.params.flatMap((p) => typeRefNames(p.type)),
        ...typeRefNames(t.returns),
      ];
    default:
      return [];
  }
}

function describeMember(m: InterfaceMember): string {
  switch (m.kind) {
    case "property-signature":
      return `${m.readonly ? "readonly " : ""}${m.name}${m.optional ? "?" : ""}: ${describeType(m.type)}`;
    case "method-signature":
      return `${m.name}${m.optional ? "?" : ""}(${describeParams(m.params)}): ${describeType(m.returnType)}`;
    case "index-signature":
      return `${m.readonly ? "readonly " : ""}[${m.keyName}: ${m.keyType}]: ${describeType(m.valueType)}`;
    case "call-signature":
      return `(${describeParams(m.params)}): ${describeType(m.returnType)}`;
    case "construct-signature":
      return `new (${describeParams(m.params)}): ${describeType(m.returnType)}`;
  }
}

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
        ...v.args.map((a, i): [string, Value] => [
          `${path}/a${i}`,
          argValue(a),
        ]),
      ];
    case "new":
      return [
        [`${path}/fn`, v.callee],
        ...v.args.map((a, i): [string, Value] => [
          `${path}/a${i}`,
          argValue(a),
        ]),
      ];
    case "tagged-template":
      return [
        [`${path}/tag`, v.tag],
        ...v.template.expressions.map((e, i): [string, Value] => [
          `${path}/x${i}`,
          e,
        ]),
      ];
    case "array":
      return v.elements.flatMap((el, i): [string, Value][] =>
        el ? [[`${path}/${i}`, elementValue(el)]] : [],
      );
    case "object":
      return v.properties.map((p, i): [string, Value] => [
        `${path}/p${i}`,
        p.value,
      ]);
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

export function labelForStatement(stmt: Statement): string {
  switch (stmt.kind) {
    case "variable-declaration":
      return `${stmt.declarationKind} ${stmt.declarations.map((d) => `${describeBinding(d.target)}${d.type ? `: ${describeType(d.type)}` : ""}`).join(", ")}`;
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

export function sourceForStatement(stmt: Statement): string | undefined {
  switch (stmt.kind) {
    case "variable-declaration":
      return truncate(
        `${stmt.declarationKind} ${stmt.declarations
          .map(
            (d) =>
              `${describeBinding(d.target)}${d.type ? `: ${describeType(d.type)}` : ""}${d.init ? ` = ${describe(d.init)}` : ""}`,
          )
          .join(", ")}`,
        80,
      );
    case "assignment":
      return truncate(
        `${describeTarget(stmt.assignmentTargetName)} ${stmt.operator} ${describe(stmt.assignmentTargetValue)}`,
        80,
      );
    case "return":
      return stmt.value
        ? truncate(`return ${describe(stmt.value)}`, 80)
        : "return";
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
              .map(
                (d) =>
                  `${describeBinding(d.target)}${d.init ? ` = ${describe(d.init)}` : ""}`,
              )
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
      return truncate(
        `function ${stmt.name}(${describeParams(stmt.params)}) {`,
        80,
      );
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// GraphBuilder — encapsulates mutable graph state and all walker methods.
// The public API is `objectToGraph` below; this class is an implementation detail.
// ---------------------------------------------------------------------------

class GraphBuilder {
  private readonly nodes: TypedGraphNode[] = [];
  private readonly edges: GraphEdge[] = [];
  private readonly seenIds = new Set<string>();
  private edgeSeq = 0;

  // Named function and arrow-function definitions: symbol name → node id.
  // Populated on function-declaration and `const f = () => …` declarations.
  private readonly funcDefs = new Map<string, string>();

  // All other named variable bindings: symbol name → node id.
  // Lets `obj.method()` calls draw a `calls` edge back to the object's declaration
  // even when that symbol is not itself a function definition.
  private readonly symbolNodes = new Map<string, string>();

  // Call sites to wire up after the full walk (functions are hoisted, so a call
  // may appear before its declaration).
  private readonly pendingCalls: { fromId: string; name: string }[] = [];

  // Interface declarations: type name → node id. Used for type-reference edges.
  private readonly typeRegistry = new Map<string, string>();
  private readonly pendingTypeRefs: { fromId: string; typeName: string }[] = [];

  private readonly options: GraphOptions;
  private readonly collapseExpr: boolean;

  constructor(options: GraphOptions) {
    // Default: expressions are collapsed into the statement label. Pass
    // `collapseExpressions: false` to emit separate expression sub-nodes.
    this.options = options;
    this.collapseExpr = options.collapseExpressions !== false;
  }

  build(statements: Statement[]): TypedGraphModel {
    this.walkBlock(statements, "s");
    this.resolvePendingCalls();
    this.resolvePendingTypeRefs();
    // Note : on n'élague PAS les fonctions sans arête — une fonction déclarée
    // (même non appelée, ex. créée en bloc libre) doit rester visible comme node.
    return { nodes: this.nodes, edges: this.edges };
  }

  // -------------------------------------------------------------------------
  // Symbol registry helpers
  // -------------------------------------------------------------------------

  private registerFuncDef(name: string, id: string): void {
    this.funcDefs.set(name, id);
  }

  private registerSymbolNode(name: string, id: string): void {
    this.symbolNodes.set(name, id);
  }

  // Look up a symbol: prefer function definitions, fall back to other bindings.
  private resolveSymbol(name: string): string | undefined {
    return this.funcDefs.get(name) ?? this.symbolNodes.get(name);
  }

  private recordCall(value: Value | undefined, fromId: string): void {
    const name = directCalleeName(value);
    if (name) this.pendingCalls.push({ fromId, name });
  }

  // -------------------------------------------------------------------------
  // Node / edge emission
  // -------------------------------------------------------------------------

  private uniqueId(path: string): string {
    let id = path;
    let i = 2;
    while (this.seenIds.has(id)) id = `${path}#${i++}`;
    this.seenIds.add(id);
    return id;
  }

  private emitNode(
    path: string,
    fields: {
      role: NodeRole;
      track: TypedGraphNode["track"];
      level: NodeLevel;
      label: string;
      astType: string;
      source?: string;
      collapsed?: boolean;
      members?: string[];
    },
    stmt: Statement | Value,
  ): string {
    const id = this.uniqueId(path);
    const node = {
      id,
      astPath: id,
      role: fields.role,
      track: fields.track,
      level: fields.level,
      label: fields.label,
      astType: fields.astType,
      stmt,
      ...(fields.source !== undefined ? { source: fields.source } : {}),
      ...(fields.collapsed !== undefined
        ? { collapsed: fields.collapsed }
        : {}),
      ...(fields.members !== undefined ? { members: fields.members } : {}),
    } as TypedGraphNode;
    this.nodes.push(node);
    return id;
  }

  private addEdge(
    source: string,
    target: string,
    kind: GraphEdge["kind"],
    handles?: {
      sourceHandle?: HandleKind;
      targetHandle?: HandleKind;
      label?: string;
    },
  ): void {
    const edge: GraphEdge = { id: `e${this.edgeSeq++}`, source, target, kind };
    if (handles?.sourceHandle) edge.sourceHandle = handles.sourceHandle;
    if (handles?.targetHandle) edge.targetHandle = handles.targetHandle;
    if (handles?.label) edge.label = handles.label;
    this.edges.push(edge);
  }

  // -------------------------------------------------------------------------
  // Value walkers (level 3 expression sub-tree)
  // -------------------------------------------------------------------------

  private walkValue(
    value: Value,
    parentId: string,
    path: string,
    sourceHandle: HandleKind = "args",
  ): string {
    const label = truncate(describe(value));
    const id = this.emitNode(
      path,
      {
        role: isLeaf(value) ? "literal" : "expression",
        track: "expression",
        level: 3,
        label,
        astType: VALUE_AST_TYPE[value.kind] ?? value.kind,
        source: label,
      },
      value,
    );
    this.addEdge(parentId, id, "expression", {
      sourceHandle,
      targetHandle: "value-out",
    });
    for (const [childPath, child] of childValues(value, path)) {
      if (isLeaf(child)) continue; // leaf summarised in parent's label
      this.walkValue(child, id, childPath);
    }
    return id;
  }

  private maybeWalkValue(value: Value, parentId: string, path: string): void {
    if (this.collapseExpr || isLeaf(value)) return;
    this.walkValue(value, parentId, path);
  }

  // -------------------------------------------------------------------------
  // Block / loop / control connectors
  // -------------------------------------------------------------------------

  // Connects a sub-block to a parent control node (loop body, try, expanded fn).
  private connectBlock(
    block: Block,
    fromId: string,
    path: string,
    kind: GraphEdge["kind"],
    label?: string,
  ): void {
    const containerFromId =
      kind === "calls" || kind === "function-body" ? fromId : undefined;
    const ends = this.walkBlock(block.content, path, containerFromId);
    if (!ends) return;
    this.addEdge(fromId, ends.headId, kind, {
      sourceHandle:
        kind === "calls" || kind === "function-body" ? "args" : "exec-out",
      targetHandle: "exec-in",
      label,
    });
  }

  // Loop body: branch-true into the body + a back-edge from the tail to the loop node.
  private connectLoopBlock(block: Block, loopId: string, path: string): void {
    const ends = this.walkBlock(block.content, path);
    if (!ends) return;
    this.addEdge(loopId, ends.headId, "branch-true", {
      sourceHandle: "branch-true",
      targetHandle: "exec-in",
      label: "body",
    });
    this.addEdge(ends.tailId, loopId, "loop-back", {
      sourceHandle: "exec-out",
      targetHandle: "exec-in",
      label: "↩",
    });
  }

  // Returns the list of if-node IDs whose branch-false port still needs connecting
  // to the next statement in sequence (open dangling-else branches).
  private buildIf(stmt: IfStatement, id: string, path: string): string[] {
    this.maybeWalkValue(stmt.condition, id, `${path}/cond`);
    const thenEnds = this.walkBlock(stmt.then.content, `${path}/then`);
    if (thenEnds)
      this.addEdge(id, thenEnds.headId, "branch-true", {
        sourceHandle: "branch-true",
        targetHandle: "exec-in",
        label: "true",
      });
    if (stmt.else) {
      if (stmt.else.kind === "if") {
        const elseIf = this.walkStatement(stmt.else, `${path}/else`);
        this.addEdge(id, elseIf.headId, "branch-false", {
          sourceHandle: "branch-false",
          targetHandle: "exec-in",
          label: "else if",
        });
        return elseIf.openFalseBranches ?? [];
      } else {
        const elseEnds = this.walkBlock(stmt.else.content, `${path}/else`);
        if (elseEnds)
          this.addEdge(id, elseEnds.headId, "branch-false", {
            sourceHandle: "branch-false",
            targetHandle: "exec-in",
            label: "false",
          });
        return [];
      }
    }
    // No else: this if's FALSE port needs connecting to the continuation.
    return [id];
  }

  private buildCase(c: SwitchCase, id: string, path: string): void {
    const ends = this.walkBlock(c.body, path);
    if (!ends) return;
    this.addEdge(id, ends.headId, "branch-true", {
      sourceHandle: "branch-true",
      targetHandle: "exec-in",
      label: c.kind === "case" ? truncate(describe(c.test)) : "default",
    });
  }

  // -------------------------------------------------------------------------
  // Statement walker
  // -------------------------------------------------------------------------

  private walkStatement(stmt: Statement, path: string): Endpoints {
    const isFuncDecl = stmt.kind === "function-declaration";
    const isIfaceDecl = stmt.kind === "interface-declaration";
    const funcVarInit = getFuncVarInit(stmt);
    const isFuncLike = isFuncDecl || funcVarInit !== null;
    const role = isFuncLike ? "boundary" : roleForStatement(stmt.kind);
    const level: NodeLevel = role === "boundary" ? 1 : 2;
    const isExpanded = isFuncLike && (this.options.expandedFunctions?.has(path) ?? false);
    const ifaceMembers = isIfaceDecl
      ? (stmt as InterfaceDeclaration).members.map(describeMember)
      : undefined;
    const astType = funcVarInit
      ? (funcVarInit.arrow ? "ArrowFunctionExpression" : "FunctionExpression")
      : (STATEMENT_AST_TYPE[stmt.kind] ?? stmt.kind);

    const id = this.emitNode(
      path,
      {
        role,
        track: "spine",
        level,
        label: labelForStatement(stmt),
        astType,
        source: sourceForStatement(stmt),
        ...(isFuncLike ? { collapsed: !isExpanded } : {}),
        ...(ifaceMembers ? { members: ifaceMembers } : {}),
      },
      stmt,
    );

    let openFalseBranches: string[] | undefined;
    let openExecTails: string[] | undefined;
    let tailId = id;

    switch (stmt.kind) {
      case "if": {
        const ob = this.buildIf(stmt, id, path);
        if (ob.length > 0) openFalseBranches = ob;
        break;
      }
      case "while":
      case "do-while":
        this.maybeWalkValue(stmt.condition, id, `${path}/cond`);
        this.connectLoopBlock(stmt.body, id, `${path}/body`);
        break;
      case "for":
        if (!this.collapseExpr) {
          if (stmt.init) {
            if (stmt.init.kind === "variable-declaration") {
              stmt.init.declarations.forEach((d, i) => {
                if (d.init) this.maybeWalkValue(d.init, id, `${path}/init${i}`);
              });
            } else {
              this.maybeWalkValue(stmt.init, id, `${path}/init`);
            }
          }
          if (stmt.test) this.maybeWalkValue(stmt.test, id, `${path}/test`);
          if (stmt.update)
            this.maybeWalkValue(stmt.update, id, `${path}/update`);
        }
        this.connectLoopBlock(stmt.body, id, `${path}/body`);
        break;
      case "for-in":
      case "for-of":
        this.maybeWalkValue(stmt.right, id, `${path}/right`);
        this.connectLoopBlock(stmt.body, id, `${path}/body`);
        break;
      case "switch":
        this.maybeWalkValue(stmt.discriminant, id, `${path}/disc`);
        stmt.cases.forEach((c, i) => this.buildCase(c, id, `${path}/case${i}`));
        break;
      case "try": {
        const tryEnds = this.walkBlock(stmt.block.content, `${path}/try`);
        if (tryEnds)
          this.addEdge(id, tryEnds.headId, "branch-true", {
            sourceHandle: "branch-true",
            targetHandle: "exec-in",
            label: "try",
          });

        let handlerTailId: string | null = null;
        let handlerAbrupt = false;
        if (stmt.handler) {
          const handlerEnds = this.walkBlock(
            stmt.handler.body.content,
            `${path}/catch`,
          );
          if (handlerEnds) {
            this.addEdge(id, handlerEnds.headId, "branch-false", {
              sourceHandle: "branch-false",
              targetHandle: "exec-in",
              label: stmt.handler.param
                ? `catch (${describeBinding(stmt.handler.param)})`
                : "catch",
            });
            handlerTailId = handlerEnds.tailId;
            handlerAbrupt = endsAbruptly(stmt.handler.body.content);
          }
        }

        if (stmt.finalizer) {
          const finalizer = stmt.finalizer;
          const tryAbrupt = tryEnds
            ? endsAbruptly(stmt.block.content)
            : false;

          // A `finally` always runs, but where control goes AFTER it depends on
          // how the protected block completed:
          //   • normal completion  → fall through to the next statement
          //   • abrupt  (throw/return) → propagate; the next statement is NOT
          //     reached. Each abrupt path therefore needs its OWN finally copy
          //     that terminates, so the graph doesn't show it continuing.
          const normalTails: string[] = [];
          if (tryEnds && !tryAbrupt) normalTails.push(tryEnds.tailId);
          if (handlerTailId && !handlerAbrupt) normalTails.push(handlerTailId);

          const abruptTails: string[] = [];
          if (tryEnds && tryAbrupt) abruptTails.push(tryEnds.tailId);
          if (handlerTailId && handlerAbrupt) abruptTails.push(handlerTailId);

          // Shared finally for the fall-through paths → continues the sequence.
          // Always emitted (even with no normal tail, e.g. empty try) so the
          // try node keeps an exec-out continuation and a layout anchor.
          const finallyNormal = this.walkBlock(
            finalizer.content,
            `${path}/finally`,
          );
          if (finallyNormal) {
            this.addEdge(id, finallyNormal.headId, "exec", {
              sourceHandle: "exec-out",
              targetHandle: "exec-in",
              label: "finally",
            });
            for (const t of normalTails)
              this.addEdge(t, finallyNormal.headId, "exec", {
                sourceHandle: "exec-out",
                targetHandle: "exec-in",
              });
            tailId = finallyNormal.tailId;
          }

          // One finally copy per abrupt path → runs, then STOPS (no outgoing
          // exec edge ⇒ an end terminus is injected, so flow halts after it).
          abruptTails.forEach((t, i) => {
            const finallyAbrupt = this.walkBlock(
              finalizer.content,
              `${path}/finally!${i}`,
            );
            if (finallyAbrupt)
              this.addEdge(t, finallyAbrupt.headId, "exec", {
                sourceHandle: "exec-out",
                targetHandle: "exec-in",
                label: "finally",
              });
          });
        } else {
          // No finally: try body tail is the primary continuation; catch tail is open.
          if (tryEnds && !endsAbruptly(stmt.block.content)) tailId = tryEnds.tailId;
          if (handlerTailId && !endsAbruptly(stmt.handler!.body.content))
            openExecTails = [handlerTailId];
        }
        break;
      }
      case "function-declaration":
        this.registerFuncDef(stmt.name, id);
        if (isExpanded)
          this.connectBlock(stmt.body, id, `${path}/body`, "function-body");
        break;
      case "interface-declaration":
        this.typeRegistry.set((stmt as InterfaceDeclaration).name, id);
        break;
      case "variable-declaration":
        stmt.declarations.forEach((d, i) => {
          if (d.init) {
            // For a func-var boundary, don't emit the function as an expression
            // sub-node — the body is connected separately via connectBlock.
            if (!(funcVarInit && d.init === funcVarInit)) {
              this.maybeWalkValue(d.init, id, `${path}/d${i}`);
            }
            this.recordCall(d.init, id);
          }
          if (d.type) {
            for (const typeName of typeRefNames(d.type)) {
              this.pendingTypeRefs.push({ fromId: id, typeName });
            }
          }
          if (d.target.kind === "variable") {
            const varName = d.target.name;
            if (d.init?.kind === "function") {
              // Arrow fn / fn expression: treat this declaration as a definition.
              this.registerFuncDef(varName, id);
              // When expanded, connect the function body like a function-declaration.
              if (isExpanded && d.init === funcVarInit) {
                const body = funcVarInit.body;
                if (body.kind === "block") {
                  this.connectBlock(body, id, `${path}/body`, "function-body");
                }
              }
            } else if (d.init?.kind === "call") {
              // The variable holds the result of a call. Resolve transitively so
              // callers of this name trace back to the originating function
              // (e.g. memoFib → memoize, counter → makeCounter).
              const calledName = directCalleeName(d.init);
              const resolvedId = calledName
                ? this.resolveSymbol(calledName)
                : undefined;
              this.registerSymbolNode(varName, resolvedId ?? id);
            } else {
              // Variable alias, destructure result, etc.
              this.registerSymbolNode(varName, id);
            }
          }
        });
        break;
      case "assignment":
        this.maybeWalkValue(stmt.assignmentTargetValue, id, `${path}/val`);
        this.recordCall(stmt.assignmentTargetValue, id);
        break;
      case "return":
        if (stmt.value) {
          this.maybeWalkValue(stmt.value, id, `${path}/val`);
          this.recordCall(stmt.value, id);
        }
        break;
      case "expression-statement":
      case "throw":
        this.maybeWalkValue(stmt.value, id, `${path}/val`);
        this.recordCall(stmt.value, id);
        break;
      // break, continue: no children to emit
    }

    return {
      headId: id,
      tailId,
      ...(openFalseBranches ? { openFalseBranches } : {}),
      ...(openExecTails ? { openExecTails } : {}),
    };
  }

  // -------------------------------------------------------------------------
  // Block walker
  // -------------------------------------------------------------------------

  private walkBlock(
    statements: Statement[],
    path: string,
    containerFromId?: string,
  ): Endpoints | null {
    let firstHead: string | null = null;
    let prevTail: string | null = null;
    let prevOpenFalse: string[] = [];
    let prevOpenExecTails: string[] = [];

    for (const [i, stmt] of statements.entries()) {
      const ends = this.walkStatement(stmt, `${path}/${i}`);

      // Definitions (function/interface/arrow-fn-var) are emitted but kept
      // out of the exec chain — they define a function, not a step in flow.
      const funcVar = getFuncVarInit(stmt);
      if (NON_EXEC.has(stmt.kind) || funcVar !== null) {
        // When inside an expanded function body, connect nested definitions
        // with a `calls` edge so they appear linked rather than floating.
        if ((stmt.kind === "function-declaration" || funcVar !== null) && containerFromId) {
          this.addEdge(containerFromId, ends.headId, "calls", {
            sourceHandle: "args",
            targetHandle: "exec-in",
          });
        }
        continue;
      }

      if (prevTail !== null) {
        this.addEdge(prevTail, ends.headId, "exec", {
          sourceHandle: "exec-out",
          targetHandle: "exec-in",
        });
        // Wire dangling FALSE ports from the previous if-chain.
        for (const fromId of prevOpenFalse) {
          this.addEdge(fromId, ends.headId, "branch-false", {
            sourceHandle: "branch-false",
            targetHandle: "exec-in",
          });
        }
        // Wire dangling exec-out tails from the previous try/catch bodies.
        for (const fromId of prevOpenExecTails) {
          this.addEdge(fromId, ends.headId, "exec", {
            sourceHandle: "exec-out",
            targetHandle: "exec-in",
          });
        }
      } else {
        firstHead = ends.headId;
      }
      prevTail = ends.tailId;
      prevOpenFalse = ends.openFalseBranches ?? [];
      prevOpenExecTails = ends.openExecTails ?? [];
    }

    if (firstHead === null || prevTail === null) return null;
    return {
      headId: firstHead,
      tailId: prevTail,
      ...(prevOpenFalse.length > 0 ? { openFalseBranches: prevOpenFalse } : {}),
      ...(prevOpenExecTails.length > 0 ? { openExecTails: prevOpenExecTails } : {}),
    };
  }

  // -------------------------------------------------------------------------
  // Post-walk resolution passes
  // -------------------------------------------------------------------------

  private resolvePendingCalls(): void {
    for (const { fromId, name } of this.pendingCalls) {
      const target = this.resolveSymbol(name);
      if (target) {
        this.addEdge(fromId, target, "calls", {
          sourceHandle: "args",
          targetHandle: "exec-in",
          label: "calls",
        });
      }
    }
  }

  private resolvePendingTypeRefs(): void {
    for (const { fromId, typeName } of this.pendingTypeRefs) {
      const target = this.typeRegistry.get(typeName);
      if (target) {
        this.addEdge(fromId, target, "calls", {
          sourceHandle: "args",
          targetHandle: "exec-in",
          label: "type",
        });
      }
    }
  }

}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function objectToGraph(
  mapping: FunctionDeclaration | FunctionValue,
  options: GraphOptions = {},
): TypedGraphModel {
  const root = mapping;
  if (!root?.body || !("kind" in root.body) || root.body.kind !== "block") {
    return { nodes: [], edges: [] };
  }
  return new GraphBuilder(options).build(root.body.content);
}
