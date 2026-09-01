import type { AgentInstallation } from "./types.ts";

export type PlannerUsableAgent = {
  id: string;
  displayName: string;
  healthStatus: AgentInstallation["healthStatus"];
  role: "worker" | "planner_surface";
  mcpServers: string[];
  skills: Array<{ name: string; description: string }>;
  /** Compact capability subset for prompt economy. */
  keyCapabilities: string[];
};

/**
 * Condensed decision packet for the host planner (main) agent.
 * Prefer this over dumping full agent rows into the planning prompt.
 */
export type PlannerBrief = {
  summary: string;
  usableAgents: PlannerUsableAgent[];
  assignmentHints: string[];
};

const KEY_CAPABILITY_PRIORITY = [
  "browser",
  "github",
  "sentry",
  "error_tracking",
  "datadog",
  "observability",
  "posthog",
  "analytics",
  "notion",
  "linear",
  "slack",
  "web_search",
  "docs_lookup",
  "database",
  "filesystem.write",
  "filesystem.read",
  "terminal",
  "tool_calls",
] as const;

function pickKeyCapabilities(capabilities: readonly string[]): string[] {
  const set = new Set(capabilities);
  const picked: string[] = [];

  for (const tag of KEY_CAPABILITY_PRIORITY) {
    if (set.has(tag)) {
      picked.push(tag);
    }
  }

  for (const tag of capabilities) {
    if (tag.startsWith("mcp:") || tag.startsWith("skill:")) {
      picked.push(tag);
    }
  }

  return [...new Set(picked)].slice(0, 24);
}

function agentRole(
  agent: AgentInstallation,
): PlannerUsableAgent["role"] {
  return agent.transport === "invocation_surface_only"
    ? "planner_surface"
    : "worker";
}

export function buildPlannerBrief(
  agents: readonly AgentInstallation[],
): PlannerBrief {
  const usable = agents.filter(
    (agent) =>
      agent.healthStatus === "healthy" || agent.healthStatus === "surface_only",
  );

  const usableAgents: PlannerUsableAgent[] = usable.map((agent) => ({
    id: agent.id,
    displayName: agent.displayName,
    healthStatus: agent.healthStatus,
    role: agentRole(agent),
    mcpServers: [...agent.mcpServers],
    skills: agent.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
    })),
    keyCapabilities: pickKeyCapabilities(agent.capabilities),
  }));

  const workers = usableAgents.filter((agent) => agent.role === "worker");
  const withTools = usableAgents.filter(
    (agent) => agent.mcpServers.length > 0 || agent.skills.length > 0,
  );

  const summary = [
    "Startup inventory for node→agent assignment.",
    `Usable agents: ${usableAgents.map((agent) => agent.id).join(", ") || "(none)"}.`,
    `Workers: ${workers.map((agent) => agent.id).join(", ") || "(none)"}.`,
    withTools.length > 0
      ? `MCP/skill coverage on: ${withTools.map((agent) => agent.id).join(", ")}.`
      : "No MCP servers or skills detected under known host paths.",
    "Use requiredCapabilities / preferredAgents per node; do not paste raw tool schemas into objectives.",
  ].join(" ");

  const assignmentHints = [
    "For each graph node, choose an agent whose keyCapabilities cover the node’s requiredCapabilities.",
    "Prefer preferredAgents when several agents share the same capability tags.",
    "Use skill:<name> when a node depends on a host skill workflow (e.g. skill:graph-design is for the planner, not a worker).",
    "Use mcp:<server> or domain tags (browser, github, …) when a node needs that integration.",
    "Default code workers to filesystem.read + filesystem.write + terminal when no special MCP/skill is required.",
  ];

  return { summary, usableAgents, assignmentHints };
}
