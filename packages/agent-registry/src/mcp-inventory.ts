import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type McpServerRef = {
  name: string;
  /** Path relative to home, for debugging without leaking secrets. */
  configRelPath: string;
};

type McpConfigDescriptor = {
  relPath: string;
  extract: (raw: string) => string[];
};

/**
 * Host MCP config locations keyed by agent candidate id.
 * Only server *names* are extracted — never env, headers, args, or URLs.
 */
const MCP_CONFIGS_BY_AGENT: Record<string, McpConfigDescriptor[]> = {
  cursor: [
    {
      relPath: ".cursor/mcp.json",
      extract: extractMcpServers,
    },
  ],
  claude: [
    {
      relPath: ".claude/.mcp.json",
      extract: extractMcpServers,
    },
    {
      relPath: ".mcp.json",
      extract: extractMcpServers,
    },
  ],
  codex: [
    {
      relPath: ".codex/.mcp.json",
      extract: extractMcpServers,
    },
  ],
  kimi: [
    {
      relPath: ".kimi-code/mcp.json",
      extract: extractMcpServers,
    },
    {
      relPath: ".kimi/mcp.json",
      extract: extractMcpServers,
    },
  ],
  gemini: [
    {
      relPath: ".gemini/settings.json",
      extract: extractMcpServers,
    },
  ],
  qwen: [
    {
      relPath: ".qwen/settings.json",
      extract: extractMcpServers,
    },
  ],
  openclaw: [
    {
      relPath: ".openclaw/openclaw.json",
      extract: extractOpenClawServers,
    },
  ],
  hermes: [
    {
      relPath: ".hermes/config.yaml",
      extract: extractHermesYamlServers,
    },
  ],
  qoder: [
    {
      relPath: ".qoder/.mcp.json",
      extract: extractMcpServers,
    },
  ],
  zcode: [
    {
      relPath: ".zcode/.mcp.json",
      extract: extractMcpServers,
    },
  ],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function keysOfRecord(value: unknown): string[] {
  if (!isPlainObject(value)) {
    return [];
  }
  return Object.keys(value).filter((key) => key.trim().length > 0);
}

function extractMcpServers(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      return [];
    }
    return keysOfRecord(parsed.mcpServers);
  } catch {
    return [];
  }
}

function extractOpenClawServers(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed) || !isPlainObject(parsed.mcp)) {
      return [];
    }
    return keysOfRecord(parsed.mcp.servers);
  } catch {
    return [];
  }
}

/**
 * Minimal YAML key scrape for Hermes `mcp_servers:` maps.
 * Does not parse values (commands/env), only immediate child keys.
 */
function extractHermesYamlServers(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const names: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    if (/^mcp_servers:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) {
      continue;
    }
    if (/^\S/.test(line)) {
      break;
    }
    const match = line.match(/^[ \t]+([A-Za-z0-9_.-]+)\s*:/);
    if (match?.[1]) {
      names.push(match[1]);
    }
  }

  return names;
}

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    return null;
  }
}

export async function listMcpServersForAgent(
  agentId: string,
  homeDir: string = homedir(),
): Promise<McpServerRef[]> {
  const descriptors = MCP_CONFIGS_BY_AGENT[agentId] ?? [];
  const seen = new Set<string>();
  const refs: McpServerRef[] = [];

  for (const descriptor of descriptors) {
    const absolutePath = join(homeDir, descriptor.relPath);
    const raw = await readOptionalText(absolutePath);
    if (raw === null) {
      continue;
    }

    for (const name of descriptor.extract(raw)) {
      const key = name.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      refs.push({
        name,
        configRelPath: descriptor.relPath,
      });
    }
  }

  return refs.sort((left, right) => left.name.localeCompare(right.name));
}

export function knownMcpAgentIds(): string[] {
  return Object.keys(MCP_CONFIGS_BY_AGENT).sort();
}
