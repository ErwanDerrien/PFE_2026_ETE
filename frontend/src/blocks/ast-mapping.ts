import _traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { LocatedAssignmentExpression } from "./types";
import type { FunctionDeclaration, FunctionValue } from "./types/function";
import type { Statement } from "./types/globalType";
import {
  type FunctionLikePath,
  getVariablesDeclaration,
  getAssignmentExpression,
  buildFunctionDeclaration,
  buildFunctionValue,
  getSwitchCase,
  getSwitchStatement,
} from "./path-extractors";
import { valueFromNode } from "./node-utils";
import type { SwitchCase, SwitchStatement } from "./types/switch-case";
import type { ReturnStatement } from "./types/returnStatement";

const traverse =
  typeof _traverse === "function" ? _traverse : (_traverse as any).default;

type Blocks =
  | FunctionDeclaration
  | FunctionValue
  | SwitchStatement
  | SwitchCase;

function getBlockBody(fn: Blocks): Statement[] | null {
  if (fn.kind == "switch") {
    return null;
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

const traversePath = (
  ast: t.File,
): Record<number, FunctionDeclaration | FunctionValue> => {
  const functionMapping: Record<number, FunctionDeclaration | FunctionValue> =
    {};
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
        functionMapping[path.scope.uid] = globalFn;
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
        body.push({ kind: "break" });
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
    // TODO: if statement (Junior)
    IfStatement(_path: NodePath<t.IfStatement>) {},

    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      const scope = current();
      if (!scope) return;
      const body = getBlockBody(scope);
      if (!body) return;
      const assignment = getAssignmentExpression(path);
      if (assignment) body.push(assignment as LocatedAssignmentExpression);
    },
  });

  // TODO: switch case (Junior)
  // TODO: while loops (Adel)
  // TODO: for loops (ideally each case) (Adel)
  // TODO: try catch (Adel)
  // TODO: throw (Adel)
  // TODO: const {a, b} = ...    a.param.  b.param (Junior)
  // TODO: Array (Junior)
  return functionMapping;
};

export default traversePath;
