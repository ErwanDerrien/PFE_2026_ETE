/**
 * BlocksCanvas — rend le `graph` du store avec React Flow (nœuds custom).
 * État contrôlé : on re-dérive nœuds/arêtes via `graphToFlow` quand le `graph`
 * change ; entre deux, le déplacement (drag) des blocs persiste.
 * Interactif : drag, sélection, pan, zoom. (Connexion/édition = plus tard.)
 */

import { useCallback, useEffect, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnSelectionChangeParams,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAstStore } from "../../sync";
import { graphToFlow } from "../graph-to-flow";
import { nodeTypes } from "../nodes";
import type { TypedGraphModel } from "../typed-nodes";

export default function BlocksCanvas() {
  const graph = useAstStore((s) => s.graph);
  const deleteNode = useAstStore((s) => s.deleteNode);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (graph.nodes.length === 0) return;
    const flow = graphToFlow(graph as TypedGraphModel);
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [graph, setNodes, setEdges]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedId(params.nodes[0]?.id ?? null);
  }, []);

  // Suppression au clavier : Backspace/Delete sur le node sélectionné.
  // On pilote depuis le store (deleteKeyCode={null} désactive la suppression
  // intégrée de React Flow) pour garder `graph` comme source unique du canvas.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (!selectedId) return;
      // Ne pas voler le Backspace d'un champ de saisie (ex. l'éditeur de code).
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      deleteNode(selectedId);
      setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, deleteNode]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onSelectionChange={onSelectionChange}
      deleteKeyCode={null}
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
