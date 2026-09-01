#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const [, , kind, configPath, serverName, command, ...args] = process.argv;

if (!kind || !configPath || !serverName || !command) {
  console.error(
    "Usage: merge-host-mcp <cursor|gemini|kimi|openclaw|qwen> <config-path> <server-name> <command> [args...]",
  );
  process.exit(64);
}

async function readJsonObject(path) {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }
    throw error;
  }
}

function buildStdioEntry(existing) {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  base.command = command;
  if (args.length > 0) {
    base.args = args;
  } else {
    delete base.args;
  }
  return base;
}

const config = await readJsonObject(configPath);

if (kind === "openclaw") {
  const mcp =
    config.mcp && typeof config.mcp === "object" && !Array.isArray(config.mcp)
      ? { ...config.mcp }
      : {};
  const servers =
    mcp.servers &&
    typeof mcp.servers === "object" &&
    !Array.isArray(mcp.servers)
      ? { ...mcp.servers }
      : {};
  servers[serverName] = {
    ...buildStdioEntry(servers[serverName]),
    enabled: true,
  };
  mcp.servers = servers;
  config.mcp = mcp;
} else if (
  kind === "cursor" ||
  kind === "gemini" ||
  kind === "kimi" ||
  kind === "qwen"
) {
  const servers =
    config.mcpServers &&
    typeof config.mcpServers === "object" &&
    !Array.isArray(config.mcpServers)
      ? { ...config.mcpServers }
      : {};
  servers[serverName] = buildStdioEntry(servers[serverName]);
  config.mcpServers = servers;
} else {
  console.error(`Unsupported kind: ${kind}`);
  process.exit(64);
}

await mkdir(dirname(configPath), { recursive: true });
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`Updated MCP server "${serverName}" (${kind}) in ${configPath}`);
