import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  Network,
  ShieldCheck,
  Users,
  WifiOff,
} from "lucide-react";
import type { GraphNode, GraphSpec, RunEvent, WorkspaceView } from "./types.ts";

type OverviewPageProps = {
  view: Exclude<WorkspaceView, "graph">;
  spec: GraphSpec;
  events: RunEvent[];
  statuses: Record<string, string>;
  onSelect: (id: string) => void;
};

export function OverviewPage({
  view,
  spec,
  events,
  statuses,
  onSelect,
}: OverviewPageProps) {
  const statusCounts = spec.nodes.reduce<Record<string, number>>(
    function countStatuses(counts, node) {
      const status = statuses[node.id] ?? "ready";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    },
    {},
  );

  if (view === "activity") {
    return (
      <div className="overview-page">
        <div className="overview-heading">
          <span>ACTIVITY</span>
          <h1>Execution timeline</h1>
          <p>Live node state and persisted run events in one place.</p>
        </div>
        <div className="overview-grid">
          <article className="metric-card">
            <Activity size={17} />
            <strong>{events.length}</strong>
            <span>recorded events</span>
          </article>
          <article className="metric-card">
            <CheckCircle2 size={17} />
            <strong>{statusCounts.succeeded ?? 0}</strong>
            <span>succeeded nodes</span>
          </article>
          <article className="metric-card">
            <Clock3 size={17} />
            <strong>{statusCounts.running ?? 0}</strong>
            <span>running now</span>
          </article>
        </div>
        <div className="overview-list">
          <h2>Recent activity</h2>
          {events.length ? (
            [...events]
              .reverse()
              .slice(0, 12)
              .map(function renderEvent(event) {
                return (
                  <button
                    key={event.sequence}
                    disabled={!event.nodeId}
                    onClick={function selectEventNode() {
                      if (event.nodeId) onSelect(event.nodeId);
                    }}
                  >
                    <span>
                      <strong>{event.type}</strong>
                      <small>
                        {event.nodeId ?? "Run"} · attempt {event.attempt}
                      </small>
                    </span>
                    <code>#{event.sequence}</code>
                  </button>
                );
              })
          ) : (
            <div className="overview-empty">
              <WifiOff size={18} />
              <strong>No run activity yet</strong>
              <span>
                Approve the graph to start a run. Events will appear here live.
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "agents") {
    const agents = new Map<string, GraphNode[]>();
    for (const node of spec.nodes) {
      const name = node.agentSelector.preferredAgents[0] ?? "Auto";
      agents.set(name, [...(agents.get(name) ?? []), node]);
    }
    return (
      <div className="overview-page">
        <div className="overview-heading">
          <span>AGENTS</span>
          <h1>Agent assignments</h1>
          <p>
            See ownership across the graph and jump directly to a node
            configuration.
          </p>
        </div>
        <div className="agent-grid">
          {[...agents].map(function renderAgent([agent, nodes]) {
            return (
              <article className="overview-card" key={agent}>
                <div className="overview-card-title">
                  <Bot size={17} />
                  <div>
                    <strong>{agent}</strong>
                    <span>
                      {nodes.length} node{nodes.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                {nodes.map(function renderAgentNode(node) {
                  return (
                    <button
                      key={node.id}
                      onClick={function selectAgentNode() {
                        onSelect(node.id);
                      }}
                    >
                      <span>{node.title}</span>
                      <small>
                        {node.kind} · {statuses[node.id] ?? "ready"}
                      </small>
                    </button>
                  );
                })}
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  const writeNodes = spec.nodes.filter(function hasWriteAccess(node) {
    return node.workspace.writeGlobs.length > 0;
  });
  const readonlyNodes = spec.nodes.length - writeNodes.length;
  return (
    <div className="overview-page">
      <div className="overview-heading">
        <span>SECURITY</span>
        <h1>Execution boundaries</h1>
        <p>
          Repository access and run policies derived from this graph
          specification.
        </p>
      </div>
      <div className="security-grid">
        <article className="overview-card">
          <Network size={18} />
          <span>Network policy</span>
          <strong>{spec.policies.networkPolicy ?? "Inherited"}</strong>
          <small>Applied to every agent session.</small>
        </article>
        <article className="overview-card">
          <ShieldCheck size={18} />
          <span>Approval</span>
          <strong>{spec.policies.approvalPolicy ?? "Human required"}</strong>
          <small>Execution stays locked during review.</small>
        </article>
        <article className="overview-card">
          <Users size={18} />
          <span>Nested agents</span>
          <strong>
            {spec.policies.nestedSubagents ? "Allowed" : "Disabled"}
          </strong>
          <small>Sub-agent delegation policy.</small>
        </article>
      </div>
      <div className="access-summary">
        <h2>Workspace access</h2>
        <div>
          <span>
            <strong>{readonlyNodes}</strong> read-only nodes
          </span>
          <span>
            <strong>{writeNodes.length}</strong> write-enabled nodes
          </span>
          <span>
            <strong>{spec.policies.maxParallel}</strong> max parallel
          </span>
        </div>
        {spec.nodes.map(function renderAccessNode(node) {
          return (
            <button
              key={node.id}
              onClick={function selectAccessNode() {
                onSelect(node.id);
              }}
            >
              <span>{node.title}</span>
              <small>
                {node.workspace.mode} ·{" "}
                {node.workspace.writeGlobs.length
                  ? `${node.workspace.writeGlobs.length} write scope(s)`
                  : "no writes"}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
