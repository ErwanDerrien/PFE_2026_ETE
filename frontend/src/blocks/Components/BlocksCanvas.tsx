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
import type { InsertTarget } from "../../shared";
import { useAstStore } from "../../sync";
import { edgeTypes } from "../edges";
import {
  HoveredEdgeProvider,
  InsertionProvider,
  type RequestInsert,
} from "../edges/insertion-context";
import { graphToFlow } from "../graph-to-flow";
import { buildStatementNode, nextNodeId, type BlockSpec } from "../node-create";
import { nodeTypes } from "../nodes";
import type { TypedGraphModel } from "../typed-nodes";
import BlockPalette from "./BlockPalette";

export default function BlocksCanvas() {
  const graph = useAstStore((s) => s.graph);
  const deleteNode = useAstStore((s) => s.deleteNode);
  const insertNode = useAstStore((s) => s.insertNode);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Insertion en cours : cible (arête à scinder) + point d'ancrage du popup.
  const [pending, setPending] = useState<
    { target: InsertTarget; x: number; y: number } | null
  >(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const requestInsert = useCallback<RequestInsert>((target, at) => {
    setPending({ target, x: at.x, y: at.y });
  }, []);

  // Bloc choisi dans la palette → construit le node et l'insère via le store.
  const onPickBlock = useCallback(
    (kind: BlockSpec["kind"]) => {
      setPending((cur) => {
        if (cur) {
          const node = buildStatementNode({ kind } as BlockSpec, nextNodeId());
          insertNode(cur.target, node);
        }
        return null;
      });
    },
    [insertNode],
  );

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
    <InsertionProvider value={requestInsert}>
      <HoveredEdgeProvider value={hoveredEdge}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdge(null)}
        deleteKeyCode={null}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
      {pending && (
        <BlockPalette
          x={pending.x}
          y={pending.y}
          onPick={onPickBlock}
          onClose={() => setPending(null)}
        />
      )}
      </HoveredEdgeProvider>
    </InsertionProvider>
  );
}
