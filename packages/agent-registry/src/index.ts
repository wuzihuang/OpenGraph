import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { execa } from "execa";
import { safeEnvironment } from "../../acp-client/src/index.ts";
import { AGENT_CANDIDATES } from "./candidates.ts";
import {
  capabilitiesFromMcpServer,
  indexAgentsByCapability,
  mergeCapabilities,
} from "./capabilities.ts";
import { listMcpServersForAgent } from "./mcp-inventory.ts";
import { buildPlannerBrief } from "./planner-brief.ts";
import {
  capabilitiesFromSkill,
  listSkillsForAgent,
} from "./skills-inventory.ts";
import type {
  AgentCandidate,
  AgentInstallation,
  CapabilitySource,
  DiscoverOptions,
  EnvironmentDiscovery,
} from "./types.ts";

export type {
  AgentInstallation,
  AgentSkillSummary,
  DiscoverOptions,
  EnvironmentDiscovery,
  PlannerBrief,
  PlannerUsableAgent,
} from "./types.ts";
export {
  capabilitiesFromMcpServer,
  indexAgentsByCapability,
  mergeCapabilities,
  normalizeMcpServerName,
  PLANNER_BASE_CAPABILITIES,
  WORKER_BASE_CAPABILITIES,
} from "./capabilities.ts";
export { listMcpServersForAgent } from "./mcp-inventory.ts";
export { buildPlannerBrief } from "./planner-brief.ts";
export {
  capabilitiesFromSkill,
  listSkillsForAgent,
} from "./skills-inventory.ts";

async function findBinary(name: string): Promise<string | null> {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const path = join(dir, name);
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {
      // keep searching
    }
  }
  return null;
}

async function enrichWithHostInventory(
  installation: AgentInstallation,
  homeDir: string,
): Promise<AgentInstallation> {
  const [mcpRefs, skillRefs] = await Promise.all([
    listMcpServersForAgent(installation.id, homeDir),
    listSkillsForAgent(installation.id, homeDir),
  ]);

  if (mcpRefs.length === 0 && skillRefs.length === 0) {
    return installation;
  }

  const mcpServers = mcpRefs.map((ref) => ref.name);
  const skills = skillRefs.map((ref) => ({
    name: ref.name,
    description: ref.description,
  }));
  const mcpCapabilities = mcpServers.flatMap((name) =>
    capabilitiesFromMcpServer(name),
  );
  const skillCapabilities = skills.flatMap((skill) =>
    capabilitiesFromSkill(skill.name),
  );
  const sources: CapabilitySource[] = [...installation.capabilitySources];
  if (mcpServers.length > 0) {
    sources.push("mcp_config");
  }
  if (skills.length > 0) {
    sources.push("skills");
  }

  return {
    ...installation,
    mcpServers,
    skills,
    capabilities: mergeCapabilities(
      installation.capabilities,
      mcpCapabilities,
      skillCapabilities,
    ),
    capabilitySources: [...new Set(sources)],
  };
}

function createUnavailableInstallation(
  candidate: AgentCandidate,
  lastProbeTime: string,
): AgentInstallation {
  const isInvocationSurface = candidate.transport === "invocation_surface_only";

  return {
    id: candidate.id,
    displayName: candidate.displayName,
    binaryPath: null,
    version: null,
    adapterCommand: [...candidate.adapter],
    transport: candidate.transport,
    authStatus: isInvocationSurface ? "not_applicable" : "unknown",
    capabilities: [...candidate.capabilities],
    mcpServers: [],
    skills: [],
    capabilitySources: ["candidate"],
    lastProbeTime,
    healthStatus: isInvocationSurface ? "surface_only" : "unavailable",
    errorMessage: isInvocationSurface
      ? null
      : `${candidate.binary} not found on PATH`,
  };
}

function createInstallation(
  candidate: AgentCandidate,
  binaryPath: string,
  lastProbeTime: string,
  version: string | null,
  healthy: boolean,
  errorMessage: string | null,
): AgentInstallation {
  const isInvocationSurface = candidate.transport === "invocation_surface_only";

  return {
    id: candidate.id,
    displayName: candidate.displayName,
    binaryPath,
    version,
    adapterCommand: [...candidate.adapter],
    transport: candidate.transport,
    authStatus: isInvocationSurface ? "not_applicable" : "unknown",
    capabilities: [...candidate.capabilities],
    mcpServers: [],
    skills: [],
    capabilitySources: ["candidate"],
    lastProbeTime,
    healthStatus: isInvocationSurface
      ? "surface_only"
      : healthy
        ? "healthy"
        : "unavailable",
    errorMessage,
  };
}

async function probeCandidate(
  candidate: AgentCandidate,
  lastProbeTime: string,
): Promise<AgentInstallation> {
  const binaryPath = await findBinary(candidate.binary);
  if (!binaryPath) {
    return createUnavailableInstallation(candidate, lastProbeTime);
  }

  try {
    const result = await execa(binaryPath, ["--version"], {
      env: safeEnvironment(),
      timeout: 1_500,
      reject: false,
    });
    const healthy = result.exitCode === 0;

    return createInstallation(
      candidate,
      binaryPath,
      lastProbeTime,
      (result.stdout || result.stderr).trim().slice(0, 200),
      healthy,
      candidate.transport === "invocation_surface_only" || healthy
        ? null
        : `version probe exited ${result.exitCode}`,
    );
  } catch (error) {
    return createInstallation(
      candidate,
      binaryPath,
      lastProbeTime,
      null,
      false,
      error instanceof Error ? error.message : "probe failed",
    );
  }
}

export async function discoverAgents(
  options: DiscoverOptions = {},
): Promise<AgentInstallation[]> {
  const lastProbeTime = new Date().toISOString();
  const homeDir = options.homeDir ?? homedir();
  const probed = await Promise.all(
    AGENT_CANDIDATES.map((candidate) =>
      probeCandidate(candidate, lastProbeTime),
    ),
  );

  return Promise.all(
    probed.map((installation) =>
      enrichWithHostInventory(installation, homeDir),
    ),
  );
}

function buildPlannerNotes(agents: AgentInstallation[]): string[] {
  const usable = agents.filter(
    (agent) =>
      agent.healthStatus === "healthy" || agent.healthStatus === "surface_only",
  );
  const withMcp = usable.filter((agent) => agent.mcpServers.length > 0);
  const withSkills = usable.filter((agent) => agent.skills.length > 0);
  const notes = [
    "Startup: read plannerBrief first — it is the condensed MCP+skills packet for node→agent decisions.",
    "Prefer agentSelector.requiredCapabilities using availableCapabilities tags; avoid embedding raw MCP tool schemas or full skill bodies in node objectives.",
    "Match domain needs (browser, github, sentry, …) to agentsByCapability; fall back to mcp:<server> or skill:<name> tags when needed.",
    "MCP inventory is name-only; skills are name+short description only. Treat both as planning hints; runtime may still lack auth.",
  ];

  if (withMcp.length === 0) {
    notes.push(
      "No host MCP server names were found under known config paths; plan with base worker capabilities unless the user states otherwise.",
    );
  } else {
    notes.push(
      `MCP server names detected for: ${withMcp
        .map((agent) => `${agent.id}[${agent.mcpServers.join(",")}]`)
        .join("; ")}.`,
    );
  }

  if (withSkills.length === 0) {
    notes.push("No host skills were found under known skill roots.");
  } else {
    notes.push(
      `Skills detected for: ${withSkills
        .map(
          (agent) =>
            `${agent.id}[${agent.skills.map((skill) => skill.name).join(",")}]`,
        )
        .join("; ")}.`,
    );
  }

  return notes;
}

export async function discoverEnvironment(
  options: DiscoverOptions = {},
): Promise<EnvironmentDiscovery> {
  const agents = await discoverAgents(options);
  const usable = agents.filter(
    (agent) =>
      agent.healthStatus === "healthy" || agent.healthStatus === "surface_only",
  );
  const availableCapabilities = mergeCapabilities(
    ...usable.map((agent) => agent.capabilities),
  );

  return {
    agents,
    availableCapabilities,
    agentsByCapability: indexAgentsByCapability(usable),
    plannerNotes: buildPlannerNotes(agents),
    plannerBrief: buildPlannerBrief(agents),
  };
}
