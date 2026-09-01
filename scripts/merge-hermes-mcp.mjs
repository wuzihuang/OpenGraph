#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const [, , configPath, serverName, command, ...args] = process.argv;

if (!configPath || !serverName || !command) {
  console.error(
    "Usage: merge-hermes-mcp <config-path> <server-name> <command> [args...]",
  );
  process.exit(64);
}

function upsertHermesMcp(raw, name, cmd, cmdArgs) {
  const blockLines = [
    "mcp_servers:",
    `  ${name}:`,
    `    command: ${JSON.stringify(cmd)}`,
  ];
  if (cmdArgs.length > 0) {
    blockLines.push(
      `    args: [${cmdArgs.map((value) => JSON.stringify(value)).join(", ")}]`,
    );
  }

  const block = `${blockLines.join("\n")}\n`;
  const re = new RegExp(`(^|\\n)mcp_servers:\\n(?:(?:[ \\t]+.*\\n)*)`, "m");
  if (re.test(raw)) {
    return raw.replace(re, (_match, prefix) => `${prefix}${block}`);
  }
  const trimmed = raw.replace(/\s*$/, "");
  return `${trimmed}\n\n${block}`;
}

let raw = "";
try {
  raw = await readFile(configPath, "utf8");
} catch (error) {
  if (!(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  )) {
    throw error;
  }
}

const next = upsertHermesMcp(
  raw || 'model:\n  default: ""\n',
  serverName,
  command,
  args,
);
await mkdir(dirname(configPath), { recursive: true });
await writeFile(configPath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
console.log(`Updated Hermes MCP server "${serverName}" in ${configPath}`);
