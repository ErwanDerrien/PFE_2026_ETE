import type { CSSProperties, MouseEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { blockMeta, isBranching, isLooping } from "../block-meta";
import { highlight } from "../highlight";
import type { TypedGraphNode } from "../typed-nodes";
import { useAstStore } from "../../sync";
import type { InsertPort } from "../../shared";
import { useRequestInsert } from "../edges/insertion-context";
import { describe, describeTarget, describeType } from "../object-to-graph";
import type { AssignmentTarget, BindingTarget } from "../types/variable";
import type { Value } from "../types/globalType";

export type BlockData = { node: TypedGraphNode; openSlots?: InsertPort[] };
export type BlockFlowNode = Node<BlockData, "block">;

// Fixed layout constants — must match blocks.css and node-size.ts.
const HEADER_H = 32;
const BODY_H = 44;

export default function BlockNode({
  data,
  selected,
}: NodeProps<BlockFlowNode>) {
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
  const looping = isLooping(node.astType);
  const isSwitch = node.astType === "SwitchStatement";
  const isTryCatch = node.astType === "TryStatement";
  const collapsed = node.role === "boundary" ? node.collapsed : false;
  const members = node.role === "statement" ? node.members : undefined;
  const code = node.source ?? node.label;
  // ── Structured breakdown (always visible, single node, no toggle) ──────────

  interface BreakdownRow {
    key: string;
    detail?: string; // e.g. ": { b, c }" for nested destructure
    value?: string; // init / assigned value
  }

  /** Walk a (possibly nested) PropertyTarget chain → flat segments. */
  function targetSegments(t: AssignmentTarget): string[] {
    if (t.kind === "variable") return [t.name];
    if (t.kind === "property")
      return [...targetSegments(t.object), `.${t.property}`];
    if (t.kind === "index")
      return [...targetSegments(t.object), `[${describe(t.index)}]`];
    return [describeTarget(t)];
  }

  /** Build breakdown rows from a BindingTarget (destructure leaf → flattened rows). */
  function bindingRows(t: BindingTarget, init?: Value): BreakdownRow[] {
    if (t.kind === "variable") {
      return [{ key: t.name, value: init ? describe(init) : undefined }];
    }
    if (t.kind === "array-destructure") {
      return t.elements.flatMap((el, i) => {
        if (!el) return [{ key: `[${i}]`, value: "␣" }]; // hole
        if (el.kind === "rest")
          return bindingRows(el.target, undefined).map((r) => ({
            ...r,
            key: `...${r.key}`,
          }));
        if (el.kind === "defaulted") {
          const defVal = describe(el.default);
          return bindingRows(el.target, undefined).map((r) => ({
            ...r,
            value: r.value ?? defVal,
          }));
        }
        // Nested destructure pattern at this index
        if (
          el.kind === "object-destructure" ||
          el.kind === "array-destructure"
        ) {
          const nestedRows = bindingRows(el, undefined).map((r) => ({
            ...r,
            key: `  ${r.key}`,
          }));
          return [
            { key: `[${i}]`, detail: `: ${describeTarget(el)}` },
            ...nestedRows,
          ];
        }
        return bindingRows(el, undefined);
      });
    }
    // object-destructure
    return t.properties.flatMap((p) => {
      if (p.kind === "rest")
        return bindingRows(p.target, undefined).map((r) => ({
          ...r,
          key: `...${r.key}`,
        }));
      let detail: string | undefined;
      if (p.nested) {
        detail = `: ${describeTarget(p.nested)}`;
      } else if (p.alias) {
        detail = `→ ${p.alias}`;
      }
      const defVal = p.default ? describe(p.default) : undefined;
      if (p.nested) {
        // Show the property key with nested pattern as detail,
        // then recurse into leaves indented.
        const nestedRows = bindingRows(p.nested, undefined).map((r) => ({
          ...r,
          key: `  ${r.key}`,
        }));
        return [{ key: p.key, detail, value: defVal }, ...nestedRows];
      }
      return [
        {
          key: p.alias ?? p.key,
          detail,
          value: defVal,
        },
      ];
    });
  }

  /** Determine if the statement merits a structured breakdown rather than a plain code line. */
  function hasBreakdown(): boolean {
    if (
      node.role === "statement" &&
      node.stmt.kind === "variable-declaration"
    ) {
      const decl = node.stmt;
      // Show breakdown when there's destructuring or multiple declarators or type annotations
      return (
        decl.declarations.length > 1 ||
        decl.declarations.some(
          (d) => d.target.kind !== "variable" || d.type !== undefined,
        )
      );
    }
    if (node.role === "statement" && node.stmt.kind === "assignment") {
      const a = node.stmt;
      // Show breakdown for chained property access (obj.a.b.c) or index access
      return (
        a.assignmentTargetName.kind === "property" ||
        a.assignmentTargetName.kind === "index" ||
        a.assignmentTargetName.kind === "array-destructure" ||
        a.assignmentTargetName.kind === "object-destructure"
      );
    }
    return false;
  }

  function renderBreakdown() {
    const stmt = node.stmt;

    if (stmt.kind === "variable-declaration") {
      const rows = stmt.declarations.flatMap((d) =>
        bindingRows(d.target, d.init).map((r) => ({
          ...r,
          type: d.type ? describeType(d.type) : undefined,
        })),
      );
      const sourceValue =
        stmt.declarations.length === 1 &&
        stmt.declarations[0].init &&
        stmt.declarations[0].target.kind !== "variable"
          ? describe(stmt.declarations[0].init)
          : undefined;
      return (
        <div className="bn-breakdown">
          {rows.map((row, i) => (
            <div key={i} className="bn-row">
              <span className="bn-row-key">{row.key}</span>
              {row.detail && (
                <span className="bn-row-detail">{row.detail}</span>
              )}
              {row.type && <span className="bn-row-type">: {row.type}</span>}
              {row.value !== undefined && (
                <span className="bn-row-value">= {row.value}</span>
              )}
            </div>
          ))}
          {sourceValue && (
            <div className="bn-row bn-row-source">
              <span className="bn-row-key">=</span>
              <span className="bn-row-value">{sourceValue}</span>
            </div>
          )}
        </div>
      );
    }

    if (stmt.kind === "assignment") {
      const segs = targetSegments(stmt.assignmentTargetName);
      const val = describe(stmt.assignmentTargetValue);
      return (
        <div className="bn-breakdown">
          <div className="bn-row bn-row-source">
            <span className="bn-row-key">
              {segs.map((s, i) => (
                <span key={i}>
                  {i > 0 && <span className="bn-row-detail">.</span>}
                  <span className="bn-chain-seg">{s.replace(/^\./, "")}</span>
                </span>
              ))}
            </span>
            <span className="bn-row-value">
              {stmt.operator} {val}
            </span>
          </div>
        </div>
      );
    }

    return null;
  }

  const breakdown = hasBreakdown() ? renderBreakdown() : null;
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

      {breakdown ? (
        <div className="bn-body bn-body-breakdown">
          <code className="bn-body-label">{highlight(code)}</code>
          {breakdown}
        </div>
      ) : (
        <div className="bn-body">
          <code>{highlight(code)}</code>
        </div>
      )}

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
            <span className="bn-foot-label">
              {collapsed ? "▶ EXPAND" : "▼ COLLAPSE"}
            </span>
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
          ) : isSwitch ? (
            /* Switch: les cases partent toutes du port CASES (sourceHandle `true`) */
            <div className="bn-foot-cell bn-foot-body">
              <span className="bn-foot-label">CASES</span>
              <Handle
                id="true"
                type="source"
                position={Position.Right}
                className="bn-exec-handle bn-handle-true"
              />
            </div>
          ) : isTryCatch ? (
            /* Try/catch: TRY (happy path) + CATCH (error path) */
            <>
              <div className="bn-foot-cell bn-foot-true">
                <span className="bn-foot-label">TRY</span>
                {openSlots.includes("true") && addBtn("true", "bn-add-port")}
                <Handle
                  id="true"
                  type="source"
                  position={Position.Right}
                  className="bn-exec-handle bn-handle-true"
                />
              </div>
              <div className="bn-foot-cell bn-foot-false">
                <span className="bn-foot-label">CATCH</span>
                {openSlots.includes("false") && addBtn("false", "bn-add-port")}
                <Handle
                  id="false"
                  type="source"
                  position={Position.Right}
                  className="bn-exec-handle bn-handle-false"
                />
              </div>
            </>
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
