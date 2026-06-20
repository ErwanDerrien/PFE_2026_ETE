import _traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { LocatedAssignmentExpression } from "./types";
import type { FunctionDeclaration, FunctionValue } from "./types/function";
import type { Block, Statement } from "./types/globalType";
import type { IfStatement } from "./types/ifStatement";
import {
  type FunctionLikePath,
  getVariablesDeclaration,
  getAssignmentExpression,
  buildFunctionDeclaration,
  buildFunctionValue,
  getSwitchCase,
  getSwitchStatement,
  getInterfaceDeclaration,
  getIfStatement,
  getWhileStatement,
  getDoWhileStatement,
  getForStatement,
  getForInStatement,
  getForOfStatement,
  getTryStatement,
  getCatchClause,
} from "./path-extractors";
import { valueFromNode } from "./node-utils";
import type { SwitchCase, SwitchStatement } from "./types/switch-case";
import type { ReturnStatement } from "./types/returnStatement";
import type {
  DoWhileStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  WhileStatement,
} from "./types/loops";
import type { TryStatement } from "./types/tryCatch";

const traverse =
  typeof _traverse === "function" ? _traverse : (_traverse as any).default;

interface IfScope {
  kind: "if-scope";
  statement: IfStatement;
  activeBranch: "then" | "else";
}

interface LoopScope {
  kind: "loop-scope";
  // null when the builder failed: the scope is kept so the matching exit()
  // stays balanced, but its body collects nothing.
  statement:
    | WhileStatement
    | DoWhileStatement
    | ForStatement
    | ForInStatement
    | ForOfStatement
    | null;
}

interface TryScope {
  kind: "try-scope";
  statement: TryStatement;
  active: "block" | "handler" | "finalizer";
}

type Blocks =
  | FunctionDeclaration
  | FunctionValue
  | SwitchStatement
  | SwitchCase
  | IfScope
  | LoopScope
  | TryScope;

function getBlockBody(fn: Blocks): Statement[] | null {
  if (fn.kind === "switch") return null;

  if (fn.kind === "if-scope") {
    const branch =
      fn.activeBranch === "then" ? fn.statement.then : fn.statement.else;
    if (!branch || branch.kind === "if") return null;
    return branch.content;
  }

  if (fn.kind === "loop-scope") {
    return fn.statement ? fn.statement.body.content : null;
  }

  if (fn.kind === "try-scope") {
    if (fn.active === "block") return fn.statement.block.content;
    if (fn.active === "handler")
      return fn.statement.handler?.body.content ?? null;
    return fn.statement.finalizer?.content ?? null;
  }

  const body = fn.body;

  if (Array.isArray(body)) {
    return body;
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "kind" in body &&
    body.kind === "block"
  ) {
    return (body as { kind: "block"; content: Statement[] }).content;
  }
  return null;
}

const traversePath = (ast: t.File): FunctionDeclaration | FunctionValue => {
  let globalFunction: FunctionDeclaration | FunctionValue | null = null;
  const scopeStack: Blocks[] = [];
  const current = () => scopeStack.at(-1);

  const onFunctionEnter = (path: FunctionLikePath, isArrow: boolean) => {
    const fn = t.isFunctionDeclaration(path.node)
      ? buildFunctionDeclaration(path as NodePath<t.FunctionDeclaration>)
      : buildFunctionValue(path, isArrow);

    // Inline FunctionDeclarations into the parent block as statements
    const parentEntry = current();
    if (parentEntry && fn.kind === "function-declaration") {
      getBlockBody(parentEntry)?.push(fn);
    }

    // functionMapping[uid] = fn;
    scopeStack.push(fn);
  };

  const onBlockExit = () => {
    scopeStack.pop();
  };

  // Push a loop statement into the current block, then enter its body scope.
  // A null statement (builder failed) still pushes a scope so the matching
  // exit() stays balanced — the loop is simply skipped.
  const enterLoop = (statement: LoopScope["statement"]) => {
    if (statement) {
      const scope = current();
      const body = scope ? getBlockBody(scope) : null;
      if (body) body.push(statement);
    }
    scopeStack.push({ kind: "loop-scope", statement });
  };

  traverse(ast, {
    Program: {
      enter(path: NodePath<t.Program>) {
        const globalFn: FunctionDeclaration = {
          kind: "function-declaration",
          name: "<global>",
          typeParams: [],
          params: [],
          async: false,
          generator: false,
          body: { kind: "block", content: [] },
        };
        globalFunction = globalFn;
        scopeStack.push(globalFn);
      },
      exit: onBlockExit,
    },

    FunctionDeclaration: {
      enter(path: NodePath<t.FunctionDeclaration>) {
        onFunctionEnter(path, false);
      },
      exit: onBlockExit,
    },
    FunctionExpression: {
      enter(path: NodePath<t.FunctionExpression>) {
        onFunctionEnter(path, false);
      },
      exit: onBlockExit,
    },
    ArrowFunctionExpression: {
      enter(path: NodePath<t.ArrowFunctionExpression>) {
        onFunctionEnter(path, true);
      },
      exit: onBlockExit,
    },
    SwitchStatement: {
      enter(_path: NodePath<t.SwitchStatement>) {
        const scope = current();

        if (!scope) return;

        const body = getBlockBody(scope);

        if (!body) return;

        const s: SwitchStatement | null = getSwitchStatement(_path);
        if (s) {
          body.push(s);
          scopeStack.push(s);
        }
      },
      exit(_path: NodePath<t.SwitchStatement>) {
        onBlockExit();
      },
    },
    SwitchCase: {
      enter(_path: NodePath<t.SwitchCase>) {
        const scope = current();

        if (!scope) return;

        const caseObj: SwitchCase | null = getSwitchCase(_path);

        if (scope.kind === "switch" && caseObj) {
          scope.cases.push(caseObj);
          scopeStack.push(caseObj);
        }
      },
      exit(_path: NodePath<t.SwitchCase>) {
        onBlockExit();
      },
    },
    BreakStatement: {
      enter(_path: NodePath<t.BreakStatement>) {
        const scope = current();
        if (!scope) return;
        const body = getBlockBody(scope);
        if (!body) return;
        body.push({ kind: "break", label: _path.node.label?.name });
      },
    },
    ContinueStatement: {
      enter(_path: NodePath<t.ContinueStatement>) {
        const scope = current();
        if (!scope) return;
        const body = getBlockBody(scope);
        if (!body) return;
        body.push({ kind: "continue", label: _path.node.label?.name });
      },
    },
    WhileStatement: {
      enter(path: NodePath<t.WhileStatement>) {
        enterLoop(getWhileStatement(path));
      },
      exit: onBlockExit,
    },
    DoWhileStatement: {
      enter(path: NodePath<t.DoWhileStatement>) {
        enterLoop(getDoWhileStatement(path));
      },
      exit: onBlockExit,
    },
    ForStatement: {
      enter(path: NodePath<t.ForStatement>) {
        enterLoop(getForStatement(path));
      },
      exit: onBlockExit,
    },
    ForInStatement: {
      enter(path: NodePath<t.ForInStatement>) {
        enterLoop(getForInStatement(path));
      },
      exit: onBlockExit,
    },
    ForOfStatement: {
      enter(path: NodePath<t.ForOfStatement>) {
        enterLoop(getForOfStatement(path));
      },
      exit: onBlockExit,
    },
    TryStatement: {
      enter(path: NodePath<t.TryStatement>) {
        const scope = current();
        if (!scope) return;
        const body = getBlockBody(scope);
        if (!body) return;
        const tryStatement = getTryStatement(path);
        body.push(tryStatement);
        scopeStack.push({
          kind: "try-scope",
          statement: tryStatement,
          active: "block",
        });
      },
      exit: onBlockExit,
    },
    CatchClause: {
      enter(path: NodePath<t.CatchClause>) {
        const scope = current();
        if (scope?.kind !== "try-scope") return;
        scope.statement.handler = getCatchClause(path);
        scope.active = "handler";
      },
    },
    ThrowStatement: {
      enter(path: NodePath<t.ThrowStatement>) {
        const scope = current();
        if (!scope) return;
        const body = getBlockBody(scope);
        if (!body) return;
        const value = valueFromNode(path.node.argument);
        if (!value) return;
        body.push({ kind: "throw", value });
      },
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      // Only capture standalone call expression statements, not calls inside other expressions
      if (!path.parentPath.isExpressionStatement()) return;
      const scope = current();
      if (!scope) return;
      const body = getBlockBody(scope);
      if (!body) return;
      const callValue = valueFromNode(path.node);
      if (!callValue) return;
      body.push({ kind: "expression-statement", value: callValue });
    },

    ReturnStatement(path: NodePath<t.ReturnStatement>) {
      if (!path.node.argument) return;
      const scope = current();
      if (!scope) return;
      const body = getBlockBody(scope);
      if (!body) return;
      const val = valueFromNode(path.node.argument);

      const blockUid = path.parentPath.scope.uid;

      const returnStatement: ReturnStatement = {
        kind: "return",
        blockUid: blockUid,
        value: val ?? undefined,
      };
      body.push(returnStatement);
    },

    VariableDeclaration(path: NodePath<t.VariableDeclaration>) {
      if (!path.parentPath.isBlockStatement() && !path.parentPath.isProgram())
        return;
      const scope = current();
      if (!scope) return;
      const body = getBlockBody(scope);
      if (!body) return;
      body.push(getVariablesDeclaration(path));
    },
    InterfaceDeclaration(path: NodePath<t.TSInterfaceDeclaration>) {
      const scope = current();
      if (!scope) return;
      const body = getBlockBody(scope);
      if (!body) return;
      const interfaceDeclaration = getInterfaceDeclaration(path);

      if (!interfaceDeclaration) return;
      body.push(interfaceDeclaration);
    },
    BlockStatement: {
      enter(path: NodePath<t.BlockStatement>) {
        const scope = current();
        if (!scope) return;
        const parentPath = path.parentPath;

        if (scope.kind === "if-scope") {
          if (!parentPath?.isIfStatement()) return;
          // Switching into the else { } branch
          if (parentPath.node.alternate === path.node) {
            const elseBlock: Block = { kind: "block", content: [] };
            scope.statement.else = elseBlock;
            scope.activeBranch = "else";
          }
          return;
        }

        if (scope.kind === "try-scope") {
          // The catch body is switched on in the CatchClause visitor. Here we
          // only handle the try block and the finally block, both direct
          // children of the TryStatement.
          if (!parentPath?.isTryStatement()) return;
          if (parentPath.node.finalizer === path.node) {
            const finalizer: Block = { kind: "block", content: [] };
            scope.statement.finalizer = finalizer;
            scope.active = "finalizer";
          } else if (parentPath.node.block === path.node) {
            scope.active = "block";
          }
        }
      },
    },
    IfStatement: {
      enter(path: NodePath<t.IfStatement>) {
        const parentPath = path.parentPath;
        const isElseIf =
          parentPath?.isIfStatement() &&
          parentPath.node.alternate === path.node;

        const scope = current();
        if (!scope) return;

        const ifStatement = getIfStatement(path);
        if (!ifStatement) return;

        if (isElseIf) {
          if (scope.kind === "if-scope") {
            scope.statement.else = ifStatement;
          }
        } else {
          const body = getBlockBody(scope);
          if (body) body.push(ifStatement);
        }

        scopeStack.push({
          kind: "if-scope",
          statement: ifStatement,
          activeBranch: "then",
        });
      },
      exit() {
        onBlockExit();
      },
    },

    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      // Skip a for-loop header assignment (init `i = 0` / update `i += 1`):
      // it is already captured by getForStatement, pushing it here too would
      // duplicate it inside the loop body.
      if (path.parentPath?.isForStatement()) return;
      const scope = current();
      if (!scope) return;
      const body = getBlockBody(scope);
      if (!body) return;
      const assignment = getAssignmentExpression(path);
      if (assignment) body.push(assignment as LocatedAssignmentExpression);
    },
  });

  if (!globalFunction) throw new Error("Program node was never visited");
  return globalFunction;
};

export default traversePath;
