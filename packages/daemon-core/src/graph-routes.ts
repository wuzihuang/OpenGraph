import type { FastifyInstance } from "fastify";
import { GraphSpecV1, type GraphSpec } from "../../contracts/src/index.ts";
import { lintGraphSpec } from "../../graph-compiler/src/index.ts";
import {
  createDemoSpec,
  createFlappyBirdSpec,
} from "../../graph-runtime/src/index.ts";
import {
  demoRepositoryRoot,
  ensureDemoRepository,
  ensureFlappyBirdRepository,
  flappyBirdRepositoryRoot,
} from "./demo-repository.ts";
import type {
  DaemonContext,
  GraphSpecBody,
  IdParams,
  PublishGraphBody,
} from "./types.ts";

function dashboardUrl(context: DaemonContext, graphId: string): string {
  return `http://${context.host}:${context.port}/?token=${context.token}&graph=${graphId}`;
}

function riskSummary(spec: GraphSpec): {
  network: GraphSpec["policies"]["networkPolicy"];
  maxParallel: number;
} {
  return {
    network: spec.policies.networkPolicy,
    maxParallel: spec.policies.maxParallel,
  };
}

export function registerGraphRoutes(
  app: FastifyInstance,
  context: DaemonContext,
): void {
  app.get("/api/graphs", async function listGraphs() {
    return context.store.listGraphs();
  });

  app.get<{ Params: IdParams }>(
    "/api/graphs/:id",
    async function getGraph(request) {
      return (
        context.store.getGraph(request.params.id) ?? { error: "NOT_FOUND" }
      );
    },
  );

  app.post<{ Body: unknown }>(
    "/api/graphs/validate",
    async function validateGraph(request) {
      return lintGraphSpec(request.body);
    },
  );

  app.post("/api/graphs/demo", async function createDemoGraph() {
    const root = demoRepositoryRoot();
    ensureDemoRepository(root);
    const spec = createDemoSpec(root);
    const validation = lintGraphSpec(spec);

    if (!validation.valid) {
      throw new Error(
        `Invalid built-in demo: ${validation.issues
          .map(function issueCode(issue) {
            return issue.code;
          })
          .join(",")}`,
      );
    }

    const projectId = context.store.createProject(root);
    const published = context.store.publishGraph(projectId, spec);

    return {
      ...published,
      projectId,
      dashboardUrl: dashboardUrl(context, published.graphId),
      validationSummary: {
        valid: true,
        errors: 0,
        warnings: validation.issues.filter(function warningIssue(issue) {
          return issue.severity === "warning";
        }).length,
      },
      riskSummary: {
        ...riskSummary(spec),
        approval: "required",
      },
    };
  });

  app.post("/api/graphs/flappy-bird", async function createFlappyBirdGraph() {
    const root = flappyBirdRepositoryRoot();
    ensureFlappyBirdRepository(root);
    const spec = createFlappyBirdSpec(root);
    const validation = lintGraphSpec(spec);

    if (!validation.valid) {
      throw new Error(
        `Invalid flappy bird graph: ${validation.issues
          .map(function issueCode(issue) {
            return issue.code;
          })
          .join(",")}`,
      );
    }

    const projectId = context.store.createProject(root);
    const published = context.store.publishGraph(projectId, spec);

    return {
      ...published,
      projectId,
      repositoryRoot: root,
      agent: process.env.OPENGRAPH_AGENT ?? "mock",
      dashboardUrl: dashboardUrl(context, published.graphId),
      validationSummary: {
        valid: true,
        errors: 0,
        warnings: validation.issues.filter(function warningIssue(issue) {
          return issue.severity === "warning";
        }).length,
      },
      riskSummary: {
        ...riskSummary(spec),
        approval: "required",
      },
    };
  });

  app.post<{ Body: PublishGraphBody }>(
    "/api/graphs/publish",
    async function publishGraph(request) {
      const spec = GraphSpecV1.parse(request.body.spec);
      const validation = lintGraphSpec(spec);

      if (!validation.valid) {
        return { error: "VALIDATION_FAILED", validation };
      }

      const projectId =
        request.body.projectId ??
        context.store.createProject(spec.repository.root);
      const published = context.store.publishGraph(projectId, spec);

      return {
        ...published,
        projectId,
        dashboardUrl: dashboardUrl(context, published.graphId),
        validationSummary: validation,
        riskSummary: riskSummary(spec),
      };
    },
  );

  app.post<{ Params: IdParams; Body: GraphSpecBody }>(
    "/api/graphs/:id/amend",
    async function amendGraph(request) {
      const spec = GraphSpecV1.parse(request.body.spec);
      const validation = lintGraphSpec(spec);

      if (!validation.valid) {
        return { error: "VALIDATION_FAILED", validation };
      }

      return {
        ...context.store.amendGraph(request.params.id, spec),
        validation,
      };
    },
  );

  app.post<{ Params: IdParams }>(
    "/api/graphs/:id/reject",
    async function rejectGraph(request) {
      const graph = context.store.getGraph(request.params.id);

      if (!graph) {
        return { error: "NOT_FOUND" };
      }

      context.store.reject(graph.id, "dashboard-human");
      return { status: "rejected" };
    },
  );

  app.post<{ Params: IdParams }>(
    "/api/graphs/:id/approve",
    async function approveGraph(request, reply) {
      const graphId = request.params.id;
      const graph = context.store.getGraph(graphId);

      if (!graph) {
        return { error: "NOT_FOUND" };
      }

      try {
        context.store.approve(graph.id, "dashboard-human");
        const projectId = context.store.getProjectIdForGraph(graphId);
        const runId = await context.runtime.start(
          projectId,
          graphId,
          graph.id,
          graph.spec,
        );

        return { status: "running", runId };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not start run";
        if (message.startsWith("Invalid GraphSpec")) {
          return reply.code(400).send({
            error: "VALIDATION_FAILED",
            message,
          });
        }
        throw error;
      }
    },
  );
}
