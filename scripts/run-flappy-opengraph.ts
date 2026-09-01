import { readFileSync } from "node:fs";
import { join } from "node:path";

const base = process.env.GRAPHD_URL ?? "http://127.0.0.1:4317";
const token = readFileSync(
  join(process.env.GRAPH_ENGINEER_HOME ?? ".graph-engineer", "session-token"),
  "utf8",
).trim();

async function api(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    ...(init.body ? { "content-type": "application/json" } : {}),
  };
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const draft = await api("/api/graphs/flappy-bird", { method: "POST" });
  console.log(
    JSON.stringify(
      {
        step: "published",
        graphId: draft.graphId,
        repositoryRoot: draft.repositoryRoot,
        agent: draft.agent,
      },
      null,
      2,
    ),
  );

  const approved = await api(`/api/graphs/${draft.graphId}/approve`, {
    method: "POST",
  });
  console.log(
    JSON.stringify(
      { step: "approved", runId: approved.runId, status: approved.status },
      null,
      2,
    ),
  );

  let status;
  do {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    status = await api(`/api/runs/${approved.runId}`);
    const nodes = Object.entries(status.state?.nodeIndex ?? {})
      .map(([id, value]) => `${id}=${value}`)
      .join(", ");
    console.log(
      JSON.stringify({ step: "poll", status: status.status, nodes }, null, 2),
    );
  } while (["pending", "running", "paused"].includes(status.status));

  const events = await api(`/api/runs/${approved.runId}/events`);
  const types = events.reduce(
    (acc: Record<string, number>, event: { type: string }) => {
      acc[event.type] = (acc[event.type] ?? 0) + 1;
      return acc;
    },
    {},
  );
  console.log(
    JSON.stringify(
      {
        step: "finished",
        status: status.status,
        eventCount: events.length,
        eventTypes: types,
        finalStatus: status.state?.finalStatus,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
