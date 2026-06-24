/**
 * BlocksCanvas — rend le `graph` du store avec React Flow (nœuds custom).
 * État contrôlé : on re-dérive nœuds/arêtes via `graphToFlow` quand le `graph`
 * change ; entre deux, le déplacement (drag) des blocs persiste.
 * Interactif : drag, sélection, pan, zoom. (Connexion/édition = plus tard.)
 */

import { useEffect } from "react";
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
import { useAstStore } from "../sync";
import { graphToFlow } from "./graph-to-flow";
import { nodeTypes } from "./nodes";

export default function BlocksCanvas() {
  const graph = useAstStore((s) => s.graph);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const flow = graphToFlow(graph);
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [graph, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
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
