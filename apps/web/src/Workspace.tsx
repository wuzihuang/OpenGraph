import { Background, Controls, ReactFlow } from "@xyflow/react";
import {
  Activity,
  Bot,
  GitBranch,
  PanelRightOpen,
  ShieldCheck,
} from "lucide-react";
import type { DashboardGraphModel } from "./graph-model.ts";
import { OverviewPage } from "./OverviewPage.tsx";
import type { AppMode, GraphSpec, RunEvent, WorkspaceView } from "./types.ts";

type WorkspaceProps = {
  mode: AppMode;
  graphId: string | null;
  spec: GraphSpec;
  view: WorkspaceView;
  inspectorOpen: boolean;
  graph: DashboardGraphModel;
  events: RunEvent[];
  statuses: Record<string, string>;
  onViewChange: (view: WorkspaceView) => void;
  onSelectNode: (id: string) => void;
  onOpenInspector: () => void;
};

function WorkspaceRail(props: {
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
}) {
  const { view, onViewChange } = props;
  return (
    <aside className="rail">
      <button
        className={view === "graph" ? "active" : ""}
        aria-label="Graph"
        onClick={function showGraph() {
          onViewChange("graph");
        }}
      >
        <GitBranch size={18} />
      </button>
      <button
        className={view === "activity" ? "active" : ""}
        aria-label="Activity"
        onClick={function showActivity() {
          onViewChange("activity");
        }}
      >
        <Activity size={18} />
      </button>
      <button
        className={view === "agents" ? "active" : ""}
        aria-label="Agents"
        onClick={function showAgents() {
          onViewChange("agents");
        }}
      >
        <Bot size={18} />
      </button>
      <span />
      <button
        className={view === "security" ? "active" : ""}
        aria-label="Security"
        onClick={function showSecurity() {
          onViewChange("security");
        }}
      >
        <ShieldCheck size={18} />
      </button>
    </aside>
  );
}

function GraphCanvas(props: {
  mode: AppMode;
  graphId: string | null;
  spec: GraphSpec;
  graph: DashboardGraphModel;
  onSelectNode: (id: string) => void;
}) {
  const { mode, graphId, spec, graph, onSelectNode } = props;
  return (
    <>
      <div className="canvas-heading">
        <span>
          {mode === "review" ? "DRAFT" : "RUN"} /{" "}
          {graphId?.slice(-6) ?? "LOCAL"}
        </span>
        <h1>{spec.goal}</h1>
        <p>
          {spec.nodes.length} nodes · max {spec.policies.maxParallel} parallel ·
          version {spec.version}
        </p>
      </div>
      <ReactFlow
        key={graph.flowKey}
        nodes={graph.flowNodes}
        edges={graph.flowEdges}
        nodeTypes={graph.nodeTypes}
        onNodeClick={function selectFlowNode(_, node) {
          onSelectNode(node.id);
        }}
        fitView
        fitViewOptions={{ padding: 0.16, minZoom: 0.4, maxZoom: 1 }}
        minZoom={0.4}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background color="#252626" gap={24} size={1} />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
      {mode === "review" && (
        <div className="approval-boundary">
          <ShieldCheck size={13} />
          Execution locked until human approval
        </div>
      )}
    </>
  );
}

export function Workspace(props: WorkspaceProps) {
  const {
    mode,
    graphId,
    spec,
    view,
    inspectorOpen,
    graph,
    events,
    statuses,
    onViewChange,
    onSelectNode,
    onOpenInspector,
  } = props;
  return (
    <>
      <WorkspaceRail view={view} onViewChange={onViewChange} />
      <div className="canvas">
        {view === "graph" ? (
          <GraphCanvas
            mode={mode}
            graphId={graphId}
            spec={spec}
            graph={graph}
            onSelectNode={onSelectNode}
          />
        ) : (
          <OverviewPage
            view={view}
            spec={spec}
            events={events}
            statuses={statuses}
            onSelect={onSelectNode}
          />
        )}{" "}
        {!inspectorOpen && (
          <button className="inspector-reopen" onClick={onOpenInspector}>
            <PanelRightOpen size={14} />
            Open inspector
          </button>
        )}
      </div>
    </>
  );
}
