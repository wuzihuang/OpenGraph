import { Bot, RotateCcw } from "lucide-react";
import type { RunEvent } from "./types.ts";

type InspectorActivityProps = {
  nodeEvents: RunEvent[];
  runUnavailable: boolean;
  onReassign: () => void;
  onRetry: () => void;
};

export function InspectorActivity(props: InspectorActivityProps) {
  const { nodeEvents, runUnavailable, onReassign, onRetry } = props;
  return (
    <section className="event-list">
      <div className="activity-actions">
        <button
          disabled={runUnavailable}
          title={
            runUnavailable ? "Approve the graph to start a run" : undefined
          }
          onClick={onReassign}
        >
          <Bot size={12} />
          Reassign agent
        </button>
        <button
          disabled={runUnavailable}
          title={
            runUnavailable ? "Approve the graph to start a run" : undefined
          }
          onClick={onRetry}
        >
          <RotateCcw size={12} />
          Retry node
        </button>
      </div>
      <label>Live agent activity</label>
      {nodeEvents.length ? (
        nodeEvents.map(function renderNodeEvent(event) {
          return (
            <article key={event.sequence}>
              <span>{event.type}</span>
              <small>
                attempt {event.attempt} · #{event.sequence}
              </small>
              <pre>{JSON.stringify(event.payload, null, 2)}</pre>
            </article>
          );
        })
      ) : (
        <div className="empty-evidence">
          No activity yet. Events replay here after reconnect.
        </div>
      )}
    </section>
  );
}
