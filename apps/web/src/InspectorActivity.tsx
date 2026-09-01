import type { RunEvent } from "./types.ts";

type InspectorActivityProps = {
  nodeEvents: RunEvent[];
};

export function InspectorActivity(props: InspectorActivityProps) {
  const { nodeEvents } = props;
  return (
    <section className="event-list">
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
          No activity yet. Events appear here while a run is live.
        </div>
      )}
    </section>
  );
}
