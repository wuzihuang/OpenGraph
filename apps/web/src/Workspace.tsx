import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Node,
} from "@xyflow/react";
import { PanelRightOpen, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { GoalCharterBanner } from "./GoalCharterBanner.tsx";
import type { DashboardGraphModel } from "./graph-model.ts";
import { LiveHud } from "./LiveHud.tsx";
import { NodePassport } from "./NodePassport.tsx";
import type { AppMode, GraphSpec, InspectorPanel, RunEvent } from "./types.ts";

type WorkspaceProps = {
  mode: AppMode;
  graphId: string | null;
  runId: string | null;
  runStatus: string;
  spec: GraphSpec;
  inspectorOpen: boolean;
  passportOpen: boolean;
  graph: DashboardGraphModel;
  events: RunEvent[];
  statuses: Record<string, string>;
  onSelectNode: (id: string) => void;
  onClosePassport: () => void;
  onOpenInspectorPanel: (panel: InspectorPanel) => void;
  onOpenInspector: () => void;
};

function mergeFlowNodes(current: Node[], incoming: Node[]): Node[] {
  const positionById = new Map(
    current.map(function getPosition(node) {
      return [node.id, node.position] as const;
    }),
  );
  return incoming.map(function mergeNode(node) {
    return {
      ...node,
      position: positionById.get(node.id) ?? node.position,
    };
  });
}

function GraphCanvas(props: {
  mode: AppMode;
  graphId: string | null;
  runId: string | null;
  runStatus: string;
  spec: GraphSpec;
  graph: DashboardGraphModel;
  events: RunEvent[];
  statuses: Record<string, string>;
  passportOpen: boolean;
  onSelectNode: (id: string) => void;
  onClosePassport: () => void;
  onOpenInspectorPanel: (panel: InspectorPanel) => void;
}) {
  const {
    mode,
    graphId,
    runId,
    runStatus,
    spec,
    graph,
    events,
    statuses,
    passportOpen,
    onSelectNode,
    onClosePassport,
    onOpenInspectorPanel,
  } = props;
  const graphNodes: Node[] = [...graph.flowZones, ...graph.flowNodes];
  const [nodes, setNodes, onNodesChange] = useNodesState(graphNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.flowEdges);
  const flowKeyRef = useRef(graph.flowKey);

  useEffect(
    function syncFlowGraph() {
      if (flowKeyRef.current !== graph.flowKey) {
        flowKeyRef.current = graph.flowKey;
        setNodes(graphNodes);
        setEdges(graph.flowEdges);
        return;
      }
      setNodes(function preserveDraggedPositions(current) {
        return mergeFlowNodes(current, graphNodes);
      });
      setEdges(graph.flowEdges);
    },
    [
      graph.flowEdges,
      graph.flowKey,
      graph.flowNodes,
      graph.flowZones,
      setEdges,
      setNodes,
    ],
  );

  const active = graph.active;
  const incoming = active
    ? spec.edges.filter(function isIncoming(edge) {
        return edge.to === active.id;
      })
    : [];
  const outgoing = active
    ? spec.edges.filter(function isOutgoing(edge) {
        return edge.from === active.id;
      })
    : [];
  const streamText = active
    ? graph.flowNodes.find(function findActiveCard(node) {
        return node.id === active.id;
      })?.data.streamText
    : undefined;

  return (
    <>
      <div className="canvas-heading">
        <span>
          {mode === "review" ? "DRAFT" : "LIVE"} /{" "}
          {graphId?.slice(-6) ?? "LOCAL"}
          {runId ? ` · ${runId.slice(-8)}` : ""}
        </span>
        <GoalCharterBanner goal={spec.goal} goalCharter={spec.goalCharter} />
        <p>
          {spec.nodes.length} nodes · max {spec.policies.maxParallel} parallel ·
          version {spec.version}
        </p>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={graph.nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={function selectFlowNode(_, node) {
          if (node.id.startsWith("__zone_")) return;
          onSelectNode(node.id);
        }}
        onPaneClick={onClosePassport}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        selectionOnDrag={false}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.35, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.8}
        defaultEdgeOptions={{ type: "default" }}
      >
        <Background color="#252626" gap={24} size={1} />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
      {mode === "run" ? (
        <LiveHud
          runId={runId}
          runStatus={runStatus}
          events={events}
          statuses={statuses}
          nodeCount={spec.nodes.length}
        />
      ) : null}
      {passportOpen && active ? (
        <NodePassport
          node={active}
          status={
            statuses[active.id] ?? (mode === "review" ? "ready" : "pending")
          }
          {...(streamText ? { streamText } : {})}
          incoming={incoming}
          outgoing={outgoing}
          onClose={onClosePassport}
          onOpenComments={function openComments() {
            onOpenInspectorPanel("comments");
          }}
          onOpenConfigure={function openConfigure() {
            onOpenInspectorPanel("configure");
          }}
          onSelectRelated={onSelectNode}
        />
      ) : null}
      {mode === "review" && (
        <div className="approval-boundary">
          <ShieldCheck size={13} />
          Display only — start runs from your coding agent
        </div>
      )}
    </>
  );
}

export function Workspace(props: WorkspaceProps) {
  const {
    mode,
    graphId,
    runId,
    runStatus,
    spec,
    inspectorOpen,
    passportOpen,
    graph,
    events,
    statuses,
    onSelectNode,
    onClosePassport,
    onOpenInspectorPanel,
    onOpenInspector,
  } = props;
  return (
    <div className="canvas canvas-full">
      <ReactFlowProvider>
        <GraphCanvas
          mode={mode}
          graphId={graphId}
          runId={runId}
          runStatus={runStatus}
          spec={spec}
          graph={graph}
          events={events}
          statuses={statuses}
          passportOpen={passportOpen}
          onSelectNode={onSelectNode}
          onClosePassport={onClosePassport}
          onOpenInspectorPanel={onOpenInspectorPanel}
        />
      </ReactFlowProvider>
      {!inspectorOpen && (
        <button className="inspector-reopen" onClick={onOpenInspector}>
          <PanelRightOpen size={14} />
          Open inspector
        </button>
      )}
    </div>
  );
}
