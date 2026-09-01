import type { FastifyInstance } from "fastify";
import {
  discoverAgents,
  discoverEnvironment,
} from "../../agent-registry/src/index.ts";
import { inspectRepository } from "../../repo-intelligence/src/index.ts";
import type { DaemonContext, RepositoryQuery } from "./types.ts";

export function registerAgentRepositoryRoutes(
  app: FastifyInstance,
  context: DaemonContext,
): void {
  app.get("/api/agents", async function getAgents() {
    return discoverAgents();
  });

  app.get("/api/environment", async function getEnvironment() {
    return discoverEnvironment();
  });

  app.get<{ Querystring: RepositoryQuery }>(
    "/api/repository",
    async function getRepository(request) {
      return inspectRepository(request.query.root ?? context.projectRoot);
    },
  );
}
