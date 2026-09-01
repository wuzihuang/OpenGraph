import type { FastifyInstance } from "fastify";
import type {
  DaemonContext,
  EventsQuery,
  IdParams,
  NodeParams,
  ReassignBody,
} from "./types.ts";

async function resumeInactiveRun(
  context: DaemonContext,
  runId: string,
  graphId: string,
  graphVersionId: string,
): Promise<boolean> {
  if (context.runtime.isActive(runId)) {
    return true;
  }

  const version = context.store.getGraphVersion(graphVersionId);
  if (!version) {
    return false;
  }

  const projectId = context.store.getProjectIdForGraph(graphId);
  await context.runtime.resume(projectId, runId, version.spec);
  return true;
}

export function registerRunRoutes(
  app: FastifyInstance,
  context: DaemonContext,
): void {
  app.get<{ Params: IdParams }>(
    "/api/runs/:id",
    async function getRun(request) {
      return context.store.getRun(request.params.id) ?? { error: "NOT_FOUND" };
    },
  );

  app.get<{ Params: IdParams; Querystring: EventsQuery }>(
    "/api/runs/:id/events",
    async function getRunEvents(request) {
      return context.store.eventsAfter(
        request.params.id,
        Number(request.query.after ?? 0),
      );
    },
  );

  app.post<{ Params: IdParams }>(
    "/api/runs/:id/cancel",
    async function cancelRun(request) {
      context.runtime.cancel(request.params.id);
      return { status: "cancelled" };
    },
  );

  app.post<{ Params: IdParams }>(
    "/api/runs/:id/pause",
    async function pauseRun(request) {
      context.runtime.pause(request.params.id);
      return { status: "paused" };
    },
  );

  app.post<{ Params: IdParams }>(
    "/api/runs/:id/resume",
    async function resumeRun(request) {
      const runId = request.params.id;
      const row = context.store.getRun(runId);

      if (!row) {
        return { error: "NOT_FOUND" };
      }

      context.runtime.resumePaused(runId);
      const resumed = await resumeInactiveRun(
        context,
        runId,
        row.graph_id,
        row.graph_version_id,
      );

      return resumed ? { status: "running" } : { error: "NOT_FOUND" };
    },
  );

  app.post<{ Params: NodeParams }>(
    "/api/runs/:id/nodes/:node/retry",
    async function retryNode(request) {
      const { id, node } = request.params;
      const row = context.store.getRun(id);

      if (!row) {
        return { error: "NOT_FOUND" };
      }

      context.runtime.retryNode(id, node);
      const resumed = await resumeInactiveRun(
        context,
        id,
        row.graph_id,
        row.graph_version_id,
      );

      return resumed ? { status: "scheduled" } : { error: "NOT_FOUND" };
    },
  );

  app.post<{ Params: NodeParams; Body: ReassignBody }>(
    "/api/runs/:id/nodes/:node/reassign",
    async function reassignNode(request) {
      const { id, node } = request.params;
      const { agent } = request.body;
      context.runtime.reassign(id, node, agent);
      return { status: "updated", agent };
    },
  );
}
