import type { CSSProperties, MouseEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { blockMeta, isBranching, isLooping } from "../block-meta";
import { highlight } from "../highlight";
import type { TypedGraphNode } from "../typed-nodes";
import { useAstStore } from "../../sync";
import type { InsertPort } from "../../shared";
import { useRequestInsert } from "../edges/insertion-context";

export type BlockData = { node: TypedGraphNode; openSlots?: InsertPort[] };
export type BlockFlowNode = Node<BlockData, "block">;

// Fixed layout constants — must match blocks.css and node-size.ts.
const HEADER_H = 32;
const BODY_H   = 44;

export default function BlockNode({ data, selected }: NodeProps<BlockFlowNode>) {
  const node = data.node;
  const openSlots = data.openSlots ?? [];
  const toggleFunctionNode = useAstStore((s) => s.toggleFunctionNode);
  const requestInsert = useRequestInsert();

  // Bouton « + » accroché à un port ouvert (fin de spine, branche/corps vide).
  const addBtn = (port: InsertPort, className: string) => (
    <button
      type="button"
      className={`bn-add-btn ${className} nodrag nopan`}
      title="Ajouter un bloc"
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        requestInsert(
          { kind: "port", nodeId: node.id, port },
          { x: e.clientX, y: e.clientY },
        );
      }}
    >
      +
    </button>
  );

  // Expand/collapse se déclenche uniquement via ce footer (pas le clic sur tout
  // le node). stopPropagation pour ne pas interférer avec la sélection/drag.
  const onToggle = (e: MouseEvent) => {
    e.stopPropagation();
    toggleFunctionNode(node.id);
  };
  const meta = blockMeta(node.astType, node.role);
  const branching = isBranching(node.astType);
  const looping   = isLooping(node.astType);
  const collapsed = node.role === "boundary" ? node.collapsed : false;
  const members   = node.role === "statement" ? node.members : undefined;
  const code = node.source ?? node.label;

  return (
    <div
      className={`bn role-${node.role}${branching ? " bn-branch" : ""}${collapsed ? " bn-collapsed" : ""}${selected ? " is-selected" : ""}`}
      style={{ "--accent": meta.accent } as CSSProperties}
    >
      {/* Exec input — left edge, vertically centred in header */}
      <Handle
        type="target"
        position={Position.Left}
        className="bn-exec-handle"
        style={{ top: HEADER_H / 2 }}
      />

      <header className="bn-head">
        <span className="bn-icon">{meta.icon}</span>
        <span className="bn-type">{meta.label}</span>
      </header>

      <div className="bn-body">
        <code>{highlight(code)}</code>
      </div>

      {/* Data output — right edge, centred in body */}
      <Handle
        id="data"
        type="source"
        position={Position.Right}
        className="bn-data-handle"
        style={{ top: HEADER_H + BODY_H / 2 }}
      />

      {/* Exec output — right edge, header level.
          Always present: used for the continuation / exit edge on ALL nodes
          (including branching nodes, where branch edges leave from the footer). */}
      <Handle
        type="source"
        position={Position.Right}
        className="bn-exec-handle"
        style={{ top: HEADER_H / 2 }}
      />
      {openSlots.includes("exec-out") && addBtn("exec-out", "bn-add-after")}

      {members && members.length > 0 && (
        <div className="bn-members">
          {members.map((m, i) => (
            <div key={i} className="bn-member-row">
              <code>{m}</code>
            </div>
          ))}
        </div>
      )}

      {node.role === "boundary" && (
        <footer className="bn-foot">
          <div
            className={`bn-foot-cell bn-foot-toggle nodrag ${collapsed ? "bn-foot-expand" : "bn-foot-collapse"}`}
            onClick={onToggle}
          >
            <span className="bn-foot-label">{collapsed ? "▶ EXPAND" : "▼ COLLAPSE"}</span>
          </div>
        </footer>
      )}
      {branching && (
        <footer className="bn-foot">
          {/* Loops: single BODY port (true = condition satisfied → enter body) */}
          {looping ? (
            <div className="bn-foot-cell bn-foot-body">
              <span className="bn-foot-label">BODY</span>
              {openSlots.includes("body") && addBtn("body", "bn-add-port")}
              <Handle
                id="true"
                type="source"
                position={Position.Right}
                className="bn-exec-handle bn-handle-true"
              />
            </div>
          ) : (
            /* Conditions: TRUE + FALSE ports */
            <>
              <div className="bn-foot-cell bn-foot-true">
                <span className="bn-foot-label">TRUE</span>
                {openSlots.includes("true") && addBtn("true", "bn-add-port")}
                <Handle
                  id="true"
                  type="source"
                  position={Position.Right}
                  className="bn-exec-handle bn-handle-true"
                />
              </div>
              <div className="bn-foot-cell bn-foot-false">
                <span className="bn-foot-label">FALSE</span>
                {openSlots.includes("false") && addBtn("false", "bn-add-port")}
                <Handle
                  id="false"
                  type="source"
                  position={Position.Right}
                  className="bn-exec-handle bn-handle-false"
                />
              </div>
            </>
          )}
        </footer>
      )}
    </div>
  );
}
