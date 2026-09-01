/**
 * Stable capability tags for planner agentSelector.requiredCapabilities.
 * Prefer these over raw MCP tool names in GraphSpec.
 */

export const WORKER_BASE_CAPABILITIES = [
  "sessions",
  "messages",
  "tool_calls",
  "terminal",
  "filesystem.read",
  "filesystem.write",
] as const;

export const PLANNER_BASE_CAPABILITIES = [
  "planner_surface",
  "skills",
  "mcp",
] as const;

/**
 * Map known MCP server name fragments to durable domain capabilities.
 * Always also emit `mcp:<normalizedServerName>`.
 */
const MCP_DOMAIN_ALIASES: Array<{ match: RegExp; capabilities: string[] }> = [
  { match: /browser|playwright|puppeteer/i, capabilities: ["browser"] },
  { match: /github/i, capabilities: ["github"] },
  { match: /gitlab/i, capabilities: ["gitlab"] },
  { match: /sentry/i, capabilities: ["sentry", "error_tracking"] },
  { match: /datadog/i, capabilities: ["datadog", "observability"] },
  { match: /posthog/i, capabilities: ["posthog", "analytics"] },
  { match: /notion/i, capabilities: ["notion"] },
  { match: /linear/i, capabilities: ["linear"] },
  { match: /slack/i, capabilities: ["slack"] },
  { match: /postman/i, capabilities: ["postman", "api_testing"] },
  { match: /cloudflare/i, capabilities: ["cloudflare"] },
  { match: /revenuecat/i, capabilities: ["revenuecat", "billing"] },
  { match: /runpod/i, capabilities: ["runpod", "gpu"] },
  { match: /context7/i, capabilities: ["docs_lookup"] },
  {
    match: /filesystem|fs\b/i,
    capabilities: ["filesystem.read", "filesystem.write"],
  },
  { match: /sqlite|postgres|database|db\b/i, capabilities: ["database"] },
  { match: /web.?search|brave.?search|tavily/i, capabilities: ["web_search"] },
];

export function normalizeMcpServerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function capabilitiesFromMcpServer(serverName: string): string[] {
  const normalized = normalizeMcpServerName(serverName);
  if (!normalized) {
    return [];
  }

  const tags = new Set<string>([`mcp:${normalized}`]);
  for (const alias of MCP_DOMAIN_ALIASES) {
    if (alias.match.test(serverName) || alias.match.test(normalized)) {
      for (const capability of alias.capabilities) {
        tags.add(capability);
      }
    }
  }
  return [...tags].sort();
}

export function mergeCapabilities(
  ...lists: readonly (readonly string[])[]
): string[] {
  const tags = new Set<string>();
  for (const list of lists) {
    for (const item of list) {
      const trimmed = item.trim();
      if (trimmed) {
        tags.add(trimmed);
      }
    }
  }
  return [...tags].sort();
}

export function indexAgentsByCapability(
  agents: ReadonlyArray<{ id: string; capabilities: readonly string[] }>,
): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const agent of agents) {
    for (const capability of agent.capabilities) {
      const bucket = index[capability] ?? [];
      bucket.push(agent.id);
      index[capability] = bucket;
    }
  }
  for (const capability of Object.keys(index)) {
    index[capability] = [...new Set(index[capability])].sort();
  }
  return Object.fromEntries(
    Object.entries(index).sort(([left], [right]) => left.localeCompare(right)),
  );
}
