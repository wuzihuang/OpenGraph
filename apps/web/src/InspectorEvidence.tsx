import type { RunEvent } from "./types.ts";

const evidenceKinds = [
  "Plan",
  "Tool calls",
  "Terminal",
  "Diff",
  "Tests",
  "Artifacts",
  "Attempts",
];

export function InspectorEvidence(props: { nodeEvents: RunEvent[] }) {
  const { nodeEvents } = props;
  return (
    <section className="evidence-grid">
      {evidenceKinds.map(function renderEvidence(kind) {
        const count = nodeEvents.filter(function matchesEvidence(event) {
          return (
            event.type
              .toLowerCase()
              .includes(kind.split(" ")[0]?.toLowerCase() ?? "") ||
            kind === "Attempts"
          );
        }).length;
        return (
          <article key={kind}>
            <label>{kind}</label>
            <strong>{count}</strong>
            <small>
              {kind === "Attempts"
                ? `${Math.max(
                    0,
                    ...nodeEvents.map(function getAttempt(event) {
                      return event.attempt;
                    }),
                  )} recorded`
                : "persisted events"}
            </small>
          </article>
        );
      })}
    </section>
  );
}
