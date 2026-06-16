import type { Block, Value } from "./globalType";
import type { BindingTarget } from "./variable";

// --- try { } catch (...) { } finally { } ---

export interface TryStatement {
  uid?: number;
  kind: "try";
  block: Block; // try { }
  handler?: CatchClause; // catch (...) { }
  finalizer?: Block; // finally { }
}

// --- catch clause ---

export interface CatchClause {
  kind: "catch";
  param?: BindingTarget; // catch (e)  |  catch ({ message })  |  catch {}
  body: Block;
}

// --- throw expr; ---

export interface ThrowStatement {
  kind: "throw";
  value: Value;
}
