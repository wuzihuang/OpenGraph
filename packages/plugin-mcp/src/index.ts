#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ensureDaemon } from "./daemon-lifecycle.ts";
import { plannerToolNames } from "./register-tools.ts";
import { createMcpServer } from "./server.ts";

export { plannerToolNames, createMcpServer };

async function main(): Promise<void> {
  await ensureDaemon();
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}

function handleMainError(error: unknown): void {
  console.error(error);
  process.exitCode = 1;
}

if (
  Boolean(process.env.GRAPH_PLUGIN_ROOT) ||
  import.meta.url === `file://${process.argv[1]}`
) {
  void main().catch(handleMainError);
}
