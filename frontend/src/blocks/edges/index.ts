import type { EdgeTypes } from "@xyflow/react";
import InsertableEdge from "./InsertableEdge";
import TerminusEdge from "./TerminusEdge";

export const edgeTypes: EdgeTypes = {
  insertable: InsertableEdge,
  "terminus-start": TerminusEdge,
};
