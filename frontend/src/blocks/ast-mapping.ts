import _traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { LocatedAssignmentExpression } from "./types";
import type {
  FunctionDeclaration as NewFnDecl,
  FunctionValue as NewFnValue,
} from "./types/function";
import type { Statement } from "./types/globalType";
import {
  type FunctionLikePath,
  getVariablesDeclaration,
  getAssignmentExpression,
  buildFunctionDeclaration,
  buildFunctionValue,
} from "./path-extractors";
import { valueFromNode } from "./node-utils";

const traverse =
  typeof _traverse === "function" ? _traverse : (_traverse as any).default;

type ScopeEntry = { uid: number; fn: NewFnDecl | NewFnValue };

function getBlockBody(fn: NewFnDecl | NewFnValue): Statement[] | null {
  const body = fn.body;
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

const traversePath = (ast: t.File): Record<number, NewFnDecl | NewFnValue> => {
  const functionMapping: Record<number, NewFnDecl | NewFnValue> = {};
  const scopeStack: ScopeEntry[] = [];
  const current = () => scopeStack.at(-1);

  const onFunctionEnter = (path: FunctionLikePath, isArrow: boolean) => {
    const uid = path.scope.uid;
    const fn = t.isFunctionDeclaration(path.node)
      ? buildFunctionDeclaration(path as NodePath<t.FunctionDeclaration>)
      : buildFunctionValue(path, isArrow);

    // Inline FunctionDeclarations into the parent block as statements
    const parentEntry = current();
    if (parentEntry && fn.kind === "function-declaration") {
      getBlockBody(parentEntry.fn)?.push(fn);
    }

    functionMapping[uid] = fn;
    scopeStack.push({ uid, fn });
  };

  const onFunctionExit = () => {
    scopeStack.pop();
  };

  traverse(ast, {
    Program: {
      enter(path: NodePath<t.Program>) {
        const globalFn: NewFnDecl = {
          kind: "function-declaration",
          name: "<global>",
          typeParams: [],
          params: [],
          async: false,
          generator: false,
          body: { kind: "block", content: [] },
        };
        functionMapping[path.scope.uid] = globalFn;
        scopeStack.push({ uid: path.scope.uid, fn: globalFn });
      },
      exit: onFunctionExit,
    },

    FunctionDeclaration: {
      enter(path: NodePath<t.FunctionDeclaration>) {
        onFunctionEnter(path, false);
      },
      exit: onFunctionExit,
    },
    FunctionExpression: {
      enter(path: NodePath<t.FunctionExpression>) {
        onFunctionEnter(path, false);
      },
      exit: onFunctionExit,
    },
    ArrowFunctionExpression: {
      enter(path: NodePath<t.ArrowFunctionExpression>) {
        onFunctionEnter(path, true);
      },
      exit: onFunctionExit,
    },

    CallExpression(path: NodePath<t.CallExpression>) {
      // Only capture standalone call expression statements, not calls inside other expressions
      if (!path.parentPath.isExpressionStatement()) return;
      const scope = current();
      if (!scope) return;
      const body = getBlockBody(scope.fn);
      if (!body) return;
      const callValue = valueFromNode(path.node);
      if (!callValue) return;
      body.push({ kind: "expression-statement", value: callValue });
    },

    ReturnStatement(path: NodePath<t.ReturnStatement>) {
      if (!path.node.argument) return;
      const scope = current();
      if (!scope) return;
      const body = getBlockBody(scope.fn);
      if (!body) return;
      const val = valueFromNode(path.node.argument);
      body.push({
        kind: "return",
        blockUid: scope.uid,
        value: val ?? undefined,
      });
    },

    VariableDeclaration(path: NodePath<t.VariableDeclaration>) {
      if (!path.parentPath.isBlockStatement() && !path.parentPath.isProgram())
        return;
      const scope = current();
      if (!scope) return;
      const body = getBlockBody(scope.fn);
      if (!body) return;
      body.push(getVariablesDeclaration(path));
    },

    // TODO: if statement (Junior)
    IfStatement(_path: NodePath<t.IfStatement>) {},

    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      const scope = current();
      if (!scope) return;
      const body = getBlockBody(scope.fn);
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
