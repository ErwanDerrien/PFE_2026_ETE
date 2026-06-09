import _traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { FunctionDetails, VariableAssignement } from "./types";
import {
  type FunctionLikePath,
  getFunctionCallInfo,
  getVariablesDeclaration,
  getParamsFromFunctionLike,
  markFunctionArguments,
  extractReturnStatement,
  processArrowFunctionReturn,
  getAssignmentExpression,
} from "./path-extractors";

const traverse =
  typeof _traverse === "function" ? _traverse : (_traverse as any).default;

// Infer a display name for any function-like node.
// For arrow functions / anonymous expressions, walk up to check if they are
// assigned to a variable (e.g. `const foo = () => {}`).
function getFunctionName(path: FunctionLikePath): string {
  const node = path.node;
  if ("id" in node && node.id) return node.id.name;
  if (path.parentPath?.isVariableDeclarator()) {
    const id = (path.parentPath.node as t.VariableDeclarator).id;
    if (t.isIdentifier(id)) return id.name;
  }
  return "<anonymous>";
}

function createEntry(path: FunctionLikePath): FunctionDetails {
  return {
    scopreUid: path.scope.uid,
    name: getFunctionName(path),
    params: getParamsFromFunctionLike(path),
    expressions: [],
    calls: [],
    subFunctions: [],
    assignments: [],
  };
}

const traversePath = (ast: t.File): Record<number, FunctionDetails> => {
  const functionMapping: Record<number, FunctionDetails> = {};
  const scopeStack: FunctionDetails[] = [];
  const current = () => scopeStack.at(-1);

  // Shared enter/exit handlers for every function-like node.
  // On enter: create an entry, link it to the parent as a subFunction, push to stack.
  // On exit:  pop so the parent becomes current again.
  const onFunctionEnter = (path: FunctionLikePath) => {
    const entry = createEntry(path);
    current()?.subFunctions.push(entry);

    functionMapping[entry.scopreUid] = entry;

    scopeStack.push(entry);
  };

  const onFunctionExit = () => {
    scopeStack.pop();
  };

  traverse(ast, {
    Program: {
      enter(path: NodePath<t.Program>) {
        const globalEntry: FunctionDetails = {
          scopreUid: path.scope.uid,
          name: "<global>",
          expressions: [],
          calls: [],
          params: [],
          subFunctions: [],
          assignments: [],
        };
        functionMapping[globalEntry.scopreUid] = globalEntry;
        scopeStack.push(globalEntry);
      },
      exit() {
        scopeStack.pop();
      },
    },

    FunctionDeclaration: {
      enter(path: NodePath<t.FunctionDeclaration>) {
        onFunctionEnter(path);
      },
      exit: onFunctionExit,
    },
    FunctionExpression: {
      enter(path: NodePath<t.FunctionExpression>) {
        onFunctionEnter(path);
      },
      exit: onFunctionExit,
    },
    ArrowFunctionExpression: {
      enter(path: NodePath<t.ArrowFunctionExpression>) {
        onFunctionEnter(path);
        const scope = current();
        processArrowFunctionReturn(path, scope);
      },
      exit: onFunctionExit,
    },

    CallExpression(path: NodePath<t.CallExpression>) {
      const scope = current();
      if (!scope) return;

      const callee = getFunctionCallInfo(path);
      if (!callee) return;

      if (t.isIdentifier(path.node.callee)) {
        const binding = path.scope.getBinding(path.node.callee.name);
        if (binding?.path.isFunctionDeclaration()) {
          callee.calleeScopeUid = binding.path.scope.uid;
        }
      }

      markFunctionArguments(path, callee);
      scope.calls.push(callee);
    },

    ReturnStatement(path: NodePath<t.ReturnStatement>) {
      if (!path.node.argument) return;
      const scope = current();
      extractReturnStatement(path, scope);
    },
    VariableDeclaration(path: NodePath<t.VariableDeclaration>) {
      if (!path.parentPath.isBlockStatement() && !path.parentPath.isProgram())
        return;
      const scope = current();
      if (!scope) return;
      scope.expressions.push(getVariablesDeclaration(path));
    },
    // TODO: if statement
    IfStatement(path: NodePath<t.IfStatement>) {
      const order = path.node.start as number;
      const scope = current();
      if (!scope) return;
    },
    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      const scope = current();
      if (!scope) return;
      const assignment: VariableAssignement | null =
        getAssignmentExpression(path);

      if (assignment) scope.assignments.push(assignment);
    },
  });

  // TODO: if statement (Junior)
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
