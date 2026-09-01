import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPlannerTools } from "./register-tools.ts";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "graph-engineer",
    version: "0.1.0",
  });
  registerPlannerTools(server);
  return server;
}
