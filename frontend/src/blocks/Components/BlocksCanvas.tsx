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
import { Button as XButton } from "@astryxdesign/core/Button";
import type { InsertTarget } from "../../shared";
import { useAstStore } from "../../sync";
import { edgeTypes } from "../edges";
import {
  HoveredEdgeProvider,
  InsertionProvider,
  type RequestInsert,
} from "../edges/insertion-context";
import { graphToFlow } from "../graph-to-flow";
import { buildStatementNode, needsForm, nextNodeId, type BlockSpec } from "../node-create";
import { nodeTypes } from "../nodes";
import type { TypedGraphModel, TypedGraphNode } from "../typed-nodes";
import BlockForm from "./BlockForm";
import BlockPalette from "./BlockPalette";
import BlockSidebar from "./BlockSidebar";

export default function BlocksCanvas() {
  const graph = useAstStore((s) => s.graph);
  const deleteNode = useAstStore((s) => s.deleteNode);
  const insertNode = useAstStore((s) => s.insertNode);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Node dont la sidebar d'édition est ouverte. Piloté par un vrai CLIC
  // (`onNodeClick`), pas par la sélection — sinon déplacer un node l'ouvrirait.
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  // Insertion en cours : cible (arête à scinder) + point d'ancrage du popup.
  const [pending, setPending] = useState<
    { target: InsertTarget; x: number; y: number } | null
  >(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  // Type de bloc dont le formulaire est ouvert (null = palette ou rien).
  const [formKind, setFormKind] = useState<BlockSpec["kind"] | null>(null);

  const requestInsert = useCallback<RequestInsert>((target, at) => {
    setFormKind(null);
    setPending({ target, x: at.x, y: at.y });
  }, []);

  const closeAll = useCallback(() => {
    setPending(null);
    setFormKind(null);
  }, []);

  // Construit et insère le node pour un BlockSpec complet, à la cible courante.
  // L'effet de bord (insertNode) reste HORS d'un updater de state : sinon
  // React StrictMode l'exécute deux fois (double insertion sur un port).
  const insertSpec = useCallback(
    (spec: BlockSpec) => {
      if (!pending) return;
      insertNode(pending.target, buildStatementNode(spec, nextNodeId()));
      setPending(null);
      setFormKind(null);
    },
    [pending, insertNode],
  );

  // Bloc choisi dans la palette : formulaire si nécessaire, sinon insertion directe.
  const onPickBlock = useCallback(
    (kind: BlockSpec["kind"]) => {
      if (needsForm(kind)) setFormKind(kind);
      else insertSpec({ kind } as BlockSpec);
    },
    [insertSpec],
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

  // Node ouvert dans la sidebar d'édition (sur clic, pas sur drag).
  const selectedNode = inspectedId
    ? (graph.nodes.find((n) => n.id === inspectedId) as TypedGraphNode | undefined)
    : undefined;

  return (
    <InsertionProvider value={requestInsert}>
      <HoveredEdgeProvider value={hoveredEdge}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onNodeClick={(_, node) => setInspectedId(node.id)}
        onPaneClick={() => setInspectedId(null)}
        onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
        onEdgeMouseLeave={() => setHoveredEdge(null)}
        deleteKeyCode={null}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        // Cadrage initial : ne jamais descendre sous 75 % de zoom. Un petit
        // graphe reste entièrement visible ; un grand graphe montre le début du
        // code à taille lisible (on navigue au lieu de tout dézoomer).
        fitViewOptions={{ padding: 0.2, minZoom: 0.75 }}
        nodesConnectable={false}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
      >
        {/* Dégradé de la spine d'exécution (violet → teal), référencé par
            graph-to-flow via stroke: url(#exec-gradient). */}
        <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
          <defs>
            <linearGradient id="exec-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b794f4" />
              <stop offset="100%" stopColor="#5adace" />
            </linearGradient>
          </defs>
        </svg>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
        <Controls showInteractive={false} />
        {/* Minimap réduite (coin bas-droit) pour laisser la place au canvas. */}
        <MiniMap pannable zoomable style={{ width: 140, height: 90 }} />
        <Panel position="top-left">
          <XButton
            label="Bloc libre"
            icon={<span aria-hidden>+</span>}
            variant="secondary"
            size="sm"
            tooltip="Créer un bloc libre (non relié)"
            onClick={(e) => requestInsert({ kind: "floating" }, { x: e.clientX, y: e.clientY })}
          />
        </Panel>
        {/* Légende compacte sur une ligne, en bas-centre : ne chevauche ni la
            minimap (bas-droit) ni les contrôles de zoom (bas-gauche). */}
        <Panel position="bottom-center" className="legend">
          <span className="legend-row">
            <span className="legend-swatch sw-exec" /> Exécution
          </span>
          <span className="legend-row">
            <span className="legend-swatch sw-true" /> Branche vraie
          </span>
          <span className="legend-row">
            <span className="legend-swatch sw-call" /> Appel
          </span>
        </Panel>
      </ReactFlow>
      {pending && !formKind && (
        <BlockPalette
          x={pending.x}
          y={pending.y}
          target={pending.target}
          onPick={onPickBlock}
          onClose={closeAll}
        />
      )}
      {pending && formKind && (
        <BlockForm
          kind={formKind}
          x={pending.x}
          y={pending.y}
          target={pending.target}
          onSubmit={insertSpec}
          onCancel={closeAll}
        />
      )}
      {selectedNode && (
        <BlockSidebar node={selectedNode} onClose={() => setInspectedId(null)} />
      )}
      </HoveredEdgeProvider>
    </InsertionProvider>
  );
}
