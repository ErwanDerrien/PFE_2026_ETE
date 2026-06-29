import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type TerminusData = { kind: "start" | "end" };
export type TerminusFlowNode = Node<TerminusData, "terminus">;

export const TERMINUS_W = 120;
export const TERMINUS_H = 32;

export default function TerminusNode({ data }: NodeProps<TerminusFlowNode>) {
  const isStart = data.kind === "start";
  return (
    <div className={`terminus terminus-${data.kind}`}>
      {!isStart && (
        <Handle
          type="target"
          position={Position.Left}
          className="terminus-handle"
          style={{ top: TERMINUS_H / 2 }}
        />
      )}
      <span className="terminus-label">{isStart ? "▶  START" : "■  END"}</span>
      {isStart && (
        <Handle
          type="source"
          position={Position.Right}
          className="terminus-handle"
          style={{ top: TERMINUS_H / 2 }}
        />
      )}
    </div>
  );
}
