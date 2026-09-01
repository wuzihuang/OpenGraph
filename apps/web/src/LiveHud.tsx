import type { RunEvent } from "./types.ts";

type LiveHudProps = {
  runId: string | null;
  runStatus: string;
  events: RunEvent[];
  statuses: Record<string, string>;
  nodeCount: number;
};

function countByStatus(statuses: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const status of Object.values(statuses)) {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

function eventPreview(event: RunEvent): string {
  const payload = event.payload;
  for (const key of ["text", "delta", "message", "error", "summary"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 120);
    }
  }
  if (typeof payload.status === "string") {
    return String(payload.status);
  }
  return "";
}

export function LiveHud(props: LiveHudProps) {
  const { runId, runStatus, events, statuses, nodeCount } = props;
  const counts = countByStatus(statuses);
  const recent = [...events].slice(-6).reverse();
  const running = Object.entries(statuses)
    .filter(function isRunning([, status]) {
      return status === "running";
    })
    .map(function getId([id]) {
      return id;
    });

  return (
    <div className="live-hud" aria-live="polite">
      <div className="live-hud-top">
        <span className={`run-pill ${runStatus}`}>{runStatus || "idle"}</span>
        <strong>{runId ? runId.slice(-10) : "no run"}</strong>
        <em>
          {counts.running ?? 0} running · {counts.succeeded ?? 0} ok ·{" "}
          {counts.failed ?? 0} failed · {Object.keys(statuses).length}/
          {nodeCount} nodes
        </em>
      </div>
      {running.length > 0 ? (
        <div className="live-loop">
          <span className="live-loop-dot" />
          Active loop: {running.join(" → ")}
        </div>
      ) : (
        <div className="live-loop muted">
          Waiting for the next ready / running node…
        </div>
      )}
      <div className="live-ticker">
        {recent.length ? (
          recent.map(function renderEvent(event) {
            const preview = eventPreview(event);
            return (
              <div key={event.sequence} className="live-tick">
                <span>#{event.sequence}</span>
                <strong>{event.type}</strong>
                <em>{event.nodeId ?? "run"}</em>
                {preview ? <small>{preview}</small> : null}
              </div>
            );
          })
        ) : (
          <div className="live-tick empty">
            No events yet — start a run from your coding agent, then stay on
            Live.
          </div>
        )}
      </div>
    </div>
  );
}
