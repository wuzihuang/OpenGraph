import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphSpecV1, type GraphSpec } from "../../contracts/src/index.ts";
import { callGraphd } from "./api.ts";
import {
  ensureDaemon,
  getGraphdBaseUrl,
  getSessionToken,
  probeDaemonHealth,
} from "./daemon-lifecycle.ts";
import { openDashboard } from "./open-dashboard.ts";

export const plannerToolNames = [
  "graph_discover_environment",
  "graph_inspect_repository",
  "graph_validate_spec",
  "graph_publish_draft",
  "graph_list_graphs",
  "graph_get_graph",
  "graph_get_run_status",
  "graph_tail_run_events",
  "graph_start_run",
  "graph_propose_amendment",
  "graph_list_node_comments",
  "graph_add_node_comment",
  "graph_open_dashboard",
] as const;

interface RepositoryInput {
  root: string;
}

interface SpecInput {
  spec: GraphSpec;
}

interface GraphInput {
  graphId: string;
}

interface StartRunInput {
  graphId?: string;
  repositoryRoot?: string;
}

type ListedGraph = {
  id: string;
  version: number;
  status: string;
  created_at: string;
  spec: GraphSpec;
};

interface RunInput {
  runId: string;
}

interface TailEventsInput extends RunInput {
  after?: number;
  limit?: number;
}

interface AmendmentInput extends GraphInput, SpecInput {}

interface OpenDashboardInput extends GraphInput {
  runId?: string;
}

interface ListCommentsInput extends GraphInput {
  nodeId?: string;
}

interface AddCommentInput extends GraphInput {
  nodeId: string;
  body: string;
}

interface TextResult {
  [key: string]: unknown;
  content: [
    {
      type: "text";
      text: string;
    },
  ];
}

export function registerPlannerTools(server: McpServer): void {
  server.registerTool(
    "graph_discover_environment",
    {
      description:
        "Discover graphd (auto-ensuring it is healthy), coding agents, and a condensed plannerBrief (MCP server names + skills) for node→agent assignment.",
    },
    discoverEnvironment,
  );
  server.registerTool(
    "graph_inspect_repository",
    {
      description: "Inspect repository rules, status, and available commands.",
      inputSchema: { root: z.string() },
    },
    inspectRepository,
  );
  server.registerTool(
    "graph_validate_spec",
    {
      description:
        "Deterministically validate a declarative GraphSpec. Requires goalCharter (strategic/medium/fast) and three loop bodies for graph mode. Re-run after every edit.",
      inputSchema: { spec: GraphSpecV1 },
    },
    validateSpec,
  );
  server.registerTool(
    "graph_publish_draft",
    {
      description:
        "Publish a validated immutable draft for human review after a mock shadow-run certifies the LangGraph can complete. Requires goalCharter and loop-body lint to pass. Returns SHADOW_FAILED (no draft) if the prior walk fails. This does not execute the real run. Dashboard is display-only; after a later explicit Execute request, call graph_start_run directly.",
      inputSchema: { spec: GraphSpecV1 },
    },
    publishDraft,
  );
  server.registerTool(
    "graph_list_graphs",
    {
      description:
        "List published graphs (newest first) with id, status, goal, repository root, and version. Use when the user says start/go but graphId is unknown.",
    },
    listGraphs,
  );
  server.registerTool(
    "graph_get_graph",
    {
      description: "Read the latest immutable version of a graph.",
      inputSchema: { graphId: z.string() },
    },
    getGraph,
  );
  server.registerTool(
    "graph_get_run_status",
    {
      description: "Read persisted run state and status.",
      inputSchema: { runId: z.string() },
    },
    getRunStatus,
  );
  server.registerTool(
    "graph_tail_run_events",
    {
      description:
        "Fetch new run events after a sequence cursor and summarize them for the host agent chat. Poll this while a run is active to stream logs into the main agent transcript.",
      inputSchema: {
        runId: z.string(),
        after: z.number().int().nonnegative().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    tailRunEvents,
  );
  server.registerTool(
    "graph_start_run",
    {
      description:
        "Call this directly when the user explicitly asks to execute the current draft. The chat request is human approval; this tool atomically records it and starts execution. It is the only start path because Dashboard has no approval/start button. Omit graphId to auto-pick newest draft. Do not ask for a second approval and do not replan.",
      inputSchema: {
        graphId: z.string().optional(),
        repositoryRoot: z.string().optional(),
      },
    },
    startRun,
  );
  server.registerTool(
    "graph_propose_amendment",
    {
      description:
        "Create a new validated graph version; running versions are never edited in place.",
      inputSchema: {
        graphId: z.string(),
        spec: GraphSpecV1,
      },
    },
    proposeAmendment,
  );
  server.registerTool(
    "graph_list_node_comments",
    {
      description:
        "List Dashboard comments left on graph nodes (human guidance for amendments).",
      inputSchema: {
        graphId: z.string(),
        nodeId: z.string().optional(),
      },
    },
    listNodeComments,
  );
  server.registerTool(
    "graph_add_node_comment",
    {
      description: "Add a comment on a graph node from the host agent.",
      inputSchema: {
        graphId: z.string(),
        nodeId: z.string(),
        body: z.string().min(1),
      },
    },
    addNodeComment,
  );
  server.registerTool(
    "graph_open_dashboard",
    {
      description:
        "Ensure local graphd is healthy, then open the review dashboard without granting approval. Returns reachable=false if the Dashboard URL would connection-refuse.",
      inputSchema: {
        graphId: z.string(),
        runId: z.string().optional(),
      },
    },
    openGraphDashboard,
  );
}

async function discoverEnvironment(): Promise<TextResult> {
  return textResult(await callGraphd<unknown>("/api/environment"));
}

async function inspectRepository({
  root,
}: RepositoryInput): Promise<TextResult> {
  return textResult(
    await callGraphd<unknown>(
      `/api/repository?root=${encodeURIComponent(root)}`,
    ),
  );
}

async function validateSpec({ spec }: SpecInput): Promise<TextResult> {
  return textResult(
    await callGraphd<unknown>("/api/graphs/validate", {
      method: "POST",
      body: JSON.stringify(spec),
    }),
  );
}

async function publishDraft({ spec }: SpecInput): Promise<TextResult> {
  const published = await callGraphd<Record<string, unknown>>(
    "/api/graphs/publish",
    {
      method: "POST",
      body: JSON.stringify({ spec }),
    },
  );
  return textResult({
    ...published,
    dashboardStartAvailable: false,
    nextAction:
      "Wait for an explicit Execute request in agent chat, then call graph_start_run directly. Never ask the user to click approval in Dashboard.",
  });
}

async function listGraphs(): Promise<TextResult> {
  const graphs = await callGraphd<ListedGraph[]>("/api/graphs");
  return textResult(
    graphs.map(function summarizeGraph(graph) {
      return {
        graphId: graph.id,
        status: graph.status,
        version: graph.version,
        createdAt: graph.created_at,
        goal: graph.spec.goal,
        repositoryRoot: graph.spec.repository.root,
      };
    }),
  );
}

async function getGraph({ graphId }: GraphInput): Promise<TextResult> {
  return textResult(await callGraphd<unknown>(`/api/graphs/${graphId}`));
}

async function getRunStatus({ runId }: RunInput): Promise<TextResult> {
  return textResult(await callGraphd<unknown>(`/api/runs/${runId}`));
}

async function tailRunEvents({
  runId,
  after = 0,
  limit = 50,
}: TailEventsInput): Promise<TextResult> {
  const [run, events] = await Promise.all([
    callGraphd<{
      status?: string;
      state?: { nodeIndex?: Record<string, string> };
    }>(`/api/runs/${runId}`),
    callGraphd<
      Array<{
        sequence: number;
        type: string;
        nodeId?: string | null;
        payload?: Record<string, unknown>;
      }>
    >(`/api/runs/${runId}/events?after=${after}`),
  ]);

  const sliced = events.slice(0, limit);
  const lines = sliced.map(function formatEvent(event) {
    const text =
      typeof event.payload?.text === "string"
        ? event.payload.text
        : typeof event.payload?.delta === "string"
          ? event.payload.delta
          : typeof event.payload?.message === "string"
            ? event.payload.message
            : typeof event.payload?.error === "string"
              ? event.payload.error
              : "";
    const node = event.nodeId ? ` [${event.nodeId}]` : "";
    return `#${event.sequence} ${event.type}${node}${text ? `: ${String(text).slice(0, 240)}` : ""}`;
  });

  const nextAfter =
    sliced.length > 0
      ? Math.max(
          ...sliced.map(function seq(event) {
            return event.sequence;
          }),
        )
      : after;

  return textResult({
    runId,
    status: run.status ?? "unknown",
    nodeIndex: run.state?.nodeIndex ?? {},
    after,
    nextAfter,
    count: sliced.length,
    lines,
    events: sliced,
  });
}

async function resolveStartGraphId(
  input: StartRunInput,
): Promise<string | null> {
  if (input.graphId) {
    return input.graphId;
  }

  const graphs = await callGraphd<ListedGraph[]>("/api/graphs");
  const drafts = graphs.filter(function isDraft(graph): boolean {
    return graph.status === "draft";
  });
  const scoped = input.repositoryRoot
    ? drafts.filter(function matchesRoot(graph): boolean {
        return graph.spec.repository.root === input.repositoryRoot;
      })
    : drafts;

  return scoped[0]?.id ?? null;
}

async function startRun(input: StartRunInput): Promise<TextResult> {
  const graphId = await resolveStartGraphId(input);

  if (!graphId) {
    return textResult({
      started: false,
      error: "NO_STARTABLE_GRAPH",
      message:
        "No draft graph found to start. Publish a graph first, or pass graphId explicitly.",
    });
  }

  const started = await callGraphd<{
    runId?: string;
    status?: string;
    error?: string;
    message?: string;
  }>(`/api/graphs/${graphId}/approve`, {
    method: "POST",
    body: JSON.stringify({ actor: "host-agent" }),
  });

  if (!started.runId) {
    return textResult({
      started: false,
      error: started.error ?? "START_FAILED",
      message: started.message,
    });
  }

  const dashboardUrl = `${getGraphdBaseUrl()}/?token=${encodeURIComponent(getSessionToken())}&graph=${encodeURIComponent(graphId)}&run=${encodeURIComponent(started.runId)}`;
  const openResult = await openDashboard(dashboardUrl);

  return textResult({
    started: true,
    graphId,
    runId: started.runId,
    status: started.status ?? "running",
    dashboardUrl,
    opened: openResult.opened,
    method: openResult.method,
    hint: "Poll graph_tail_run_events with this runId and stream notable lines into the chat for the user.",
  });
}

async function proposeAmendment({
  graphId,
  spec,
}: AmendmentInput): Promise<TextResult> {
  return textResult(
    await callGraphd<unknown>(`/api/graphs/${graphId}/amend`, {
      method: "POST",
      body: JSON.stringify({ spec }),
    }),
  );
}

async function listNodeComments({
  graphId,
  nodeId,
}: ListCommentsInput): Promise<TextResult> {
  const query = nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : "";
  return textResult(
    await callGraphd<unknown>(`/api/graphs/${graphId}/comments${query}`),
  );
}

async function addNodeComment({
  graphId,
  nodeId,
  body,
}: AddCommentInput): Promise<TextResult> {
  return textResult(
    await callGraphd<unknown>(`/api/graphs/${graphId}/comments`, {
      method: "POST",
      body: JSON.stringify({ nodeId, body, role: "system" }),
    }),
  );
}

async function openGraphDashboard({
  graphId,
  runId,
}: OpenDashboardInput): Promise<TextResult> {
  let daemon = await ensureDaemon();
  let reachable = await probeDaemonHealth();

  if (!reachable) {
    daemon = await ensureDaemon({ forceRestart: true });
    reachable = await probeDaemonHealth();
  }

  const params = new URLSearchParams({
    token: getSessionToken(),
    graph: graphId,
  });
  if (runId) {
    params.set("run", runId);
  }
  const dashboardUrl = `${getGraphdBaseUrl()}/?${params.toString()}`;

  if (!reachable) {
    return textResult({
      dashboardUrl,
      opened: false,
      reachable: false,
      daemon: daemon.status,
      error: `graphd is not reachable at ${getGraphdBaseUrl()}. Dashboard was not opened to avoid a connection-refused browser error.`,
    });
  }

  const openResult = await openDashboard(dashboardUrl);
  return textResult({
    dashboardUrl,
    opened: openResult.opened,
    reachable: true,
    daemon: daemon.status,
    method: openResult.method,
    error: openResult.error,
  });
}

function textResult(value: unknown): TextResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
