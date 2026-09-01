import type { PlannerBrief } from "./planner-brief.ts";

export type AgentTransport = "acp-stdio" | "invocation_surface_only";

export type CapabilitySource = "candidate" | "mcp_config" | "skills";

export type AgentSkillSummary = {
  name: string;
  description: string;
};

export type AgentInstallation = {
  id: string;
  displayName: string;
  binaryPath: string | null;
  version: string | null;
  adapterCommand: string[];
  transport: AgentTransport;
  authStatus: "unknown" | "not_applicable";
  /** Stable capability tags for GraphSpec agentSelector.requiredCapabilities. */
  capabilities: string[];
  /** MCP server names only — never env, args, headers, or URLs. */
  mcpServers: string[];
  /** Host skills (name + short description only). */
  skills: AgentSkillSummary[];
  capabilitySources: CapabilitySource[];
  lastProbeTime: string;
  healthStatus: "healthy" | "unavailable" | "surface_only";
  errorMessage: string | null;
};

export type AgentCandidate = {
  id: string;
  displayName: string;
  binary: string;
  adapter: string[];
  transport: AgentTransport;
  capabilities: string[];
};

export type { PlannerBrief, PlannerUsableAgent } from "./planner-brief.ts";

export type EnvironmentDiscovery = {
  agents: AgentInstallation[];
  /** Union of capabilities across discovered agents (healthy or surface_only). */
  availableCapabilities: string[];
  /** capability → agent ids that advertise it. */
  agentsByCapability: Record<string, string[]>;
  /**
   * Short planner-facing notes. Prefer capability tags in agentSelector;
   * do not dump raw tool schemas into the graph plan.
   */
  plannerNotes: string[];
  /**
   * Condensed decision brief for the main (host) planner agent:
   * which agents exist, their MCP/skills, and how to assign nodes.
   */
  plannerBrief: PlannerBrief;
};

export type DiscoverOptions = {
  homeDir?: string;
};
