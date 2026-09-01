import { MessageSquare, Settings2, X } from "lucide-react";
import type { GraphEdge, GraphNode } from "./types.ts";

type NodePassportProps = {
  node: GraphNode;
  status: string;
  streamText?: string;
  incoming: GraphEdge[];
  outgoing: GraphEdge[];
  onClose: () => void;
  onOpenComments: () => void;
  onOpenConfigure: () => void;
  onSelectRelated: (nodeId: string) => void;
};

export function NodePassport(props: NodePassportProps) {
  const {
    node,
    status,
    streamText,
    incoming,
    outgoing,
    onClose,
    onOpenComments,
    onOpenConfigure,
    onSelectRelated,
  } = props;

  const statusClass =
    status === "running" || status === "ready"
      ? "live"
      : status === "succeeded"
        ? "ok"
        : status === "failed" || status === "cancelled"
          ? "bad"
          : "";

  return (
    <aside className="passport-panel" role="dialog" aria-label="Node passport">
      <header>
        <div>
          <span>NODE PASSPORT</span>
          <h3>{node.title}</h3>
        </div>
        <button
          type="button"
          className="passport-close"
          aria-label="Close passport"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </header>
      <div className="passport-meta">
        <em>{node.kind}</em>
        <em className={statusClass}>{status}</em>
        <em>{node.agentSelector.preferredAgents[0] ?? "Auto"}</em>
      </div>
      <p>{node.objective}</p>
      {streamText ? <pre>{streamText}</pre> : null}
      <div className="passport-relations">
        {outgoing.map(function renderOut(edge) {
          return (
            <button
              key={`out-${edge.to}-${edge.artifacts.join("-")}`}
              type="button"
              onClick={function selectOut() {
                onSelectRelated(edge.to);
              }}
            >
              <span>
                → {edge.to}
              </span>
              <small>out · {edge.artifacts.join(" + ") || "link"}</small>
            </button>
          );
        })}
        {incoming.map(function renderIn(edge) {
          return (
            <button
              key={`in-${edge.from}-${edge.artifacts.join("-")}`}
              type="button"
              onClick={function selectIn() {
                onSelectRelated(edge.from);
              }}
            >
              <span>
                ← {edge.from}
              </span>
              <small>in · {edge.artifacts.join(" + ") || "link"}</small>
            </button>
          );
        })}
        {!outgoing.length && !incoming.length ? (
          <p>No connected relationships on this node.</p>
        ) : null}
      </div>
      <div className="passport-actions">
        <button type="button" onClick={onOpenConfigure}>
          <Settings2 size={13} /> Configure
        </button>
        <button type="button" className="primary" onClick={onOpenComments}>
          <MessageSquare size={13} /> Comments
        </button>
      </div>
    </aside>
  );
}
