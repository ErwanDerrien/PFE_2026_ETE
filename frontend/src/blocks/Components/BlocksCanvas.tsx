/**
 * BlocksCanvas — rend le `graph` du store avec React Flow (nœuds custom).
 * État contrôlé : on re-dérive nœuds/arêtes via `graphToFlow` quand le `graph`
 * change ; entre deux, le déplacement (drag) des blocs persiste.
 * Interactif : drag, sélection, pan, zoom. (Connexion/édition = plus tard.)
 */

import { useCallback, useEffect } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAstStore } from "../../sync";
import { graphToFlow } from "../graph-to-flow";
import { nodeTypes } from "../nodes";
import type { BlockFlowNode } from "../nodes/BlockNode";
import type { TypedGraphModel } from "../typed-nodes";

export default function BlocksCanvas() {
  const graph = useAstStore((s) => s.graph);
  const toggleFunctionNode = useAstStore((s) => s.toggleFunctionNode);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (graph.nodes.length === 0) return;
    const flow = graphToFlow(graph as TypedGraphModel);
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [graph, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const blockNode = node as BlockFlowNode;
      const gNode = blockNode.data?.node;
      if (gNode?.astType === "FunctionDeclaration") {
        toggleFunctionNode(gNode.id);
      }
    },
    [toggleFunctionNode],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesConnectable={false}
      colorMode="dark"
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={2}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
      <Panel position="top-right" className="legend">
        <div className="legend-title">LEGEND</div>
        <div className="legend-row">
          <span className="legend-swatch sw-exec" /> Execution Flow
        </div>
        <div className="legend-row">
          <span className="legend-swatch sw-true" /> True Branch
        </div>
        <div className="legend-row">
          <span className="legend-swatch sw-call" /> Function Call
        </div>
      </Panel>
    </ReactFlow>
  );
}
