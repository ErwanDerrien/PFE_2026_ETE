import type { CSSProperties } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { GraphNode } from "../../shared";
import { blockMeta, isBranching, isLooping } from "../block-meta";
import { highlight } from "../highlight";

export type BlockData = { node: GraphNode };
export type BlockFlowNode = Node<BlockData, "block">;

// Fixed layout constants — must match blocks.css and node-size.ts.
const HEADER_H = 32;
const BODY_H   = 44;

export default function BlockNode({ data, selected }: NodeProps<BlockFlowNode>) {
  const node = data.node;
  const meta = blockMeta(node.astType, node.role);
  const branching = isBranching(node.astType);
  const looping   = isLooping(node.astType);
  const collapsed = node.collapsed === true;
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

      {node.collapsed !== undefined && (
        <footer className="bn-foot">
          <div className={`bn-foot-cell ${collapsed ? "bn-foot-expand" : "bn-foot-collapse"}`}>
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
                <Handle
                  id="true"
                  type="source"
                  position={Position.Right}
                  className="bn-exec-handle bn-handle-true"
                />
              </div>
              <div className="bn-foot-cell bn-foot-false">
                <span className="bn-foot-label">FALSE</span>
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
