import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphSpecV1, type GraphSpec } from "../../contracts/src/index.ts";
import { callGraphd } from "./api.ts";
import { getGraphdBaseUrl, getSessionToken } from "./daemon-lifecycle.ts";
import { openDashboard } from "./open-dashboard.ts";

export const plannerToolNames = [
  "graph_discover_environment",
  "graph_inspect_repository",
  "graph_validate_spec",
  "graph_publish_draft",
  "graph_get_graph",
  "graph_get_run_status",
  "graph_propose_amendment",
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

interface RunInput {
  runId: string;
}

interface AmendmentInput extends GraphInput, SpecInput {}

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
        "Discover graphd, coding agents, and a condensed plannerBrief (MCP server names + skills) for node→agent assignment.",
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
        "Deterministically validate a declarative GraphSpec. Re-run after every edit.",
      inputSchema: { spec: GraphSpecV1 },
    },
    validateSpec,
  );
  server.registerTool(
    "graph_publish_draft",
    {
      description:
        "Publish a validated immutable draft for human review. This does not approve or execute it.",
      inputSchema: { spec: GraphSpecV1 },
    },
    publishDraft,
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
    "graph_open_dashboard",
    {
      description: "Open the local review dashboard without granting approval.",
      inputSchema: { graphId: z.string() },
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
  return textResult(
    await callGraphd<unknown>("/api/graphs/publish", {
      method: "POST",
      body: JSON.stringify({ spec }),
    }),
  );
}

async function getGraph({ graphId }: GraphInput): Promise<TextResult> {
  return textResult(await callGraphd<unknown>(`/api/graphs/${graphId}`));
}

async function getRunStatus({ runId }: RunInput): Promise<TextResult> {
  return textResult(await callGraphd<unknown>(`/api/runs/${runId}`));
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

async function openGraphDashboard({
  graphId,
}: GraphInput): Promise<TextResult> {
  const dashboardUrl = `${getGraphdBaseUrl()}/?token=${encodeURIComponent(getSessionToken())}&graph=${encodeURIComponent(graphId)}`;
  const openResult = await openDashboard(dashboardUrl);
  return textResult({
    dashboardUrl,
    opened: openResult.opened,
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
