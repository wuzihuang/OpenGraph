import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EventStore } from "../../event-store/src/index.ts";
import {
  createRuntimeAgent,
  GraphRuntime,
} from "../../graph-runtime/src/index.ts";
import { registerAgentRepositoryRoutes } from "./agent-repository-routes.ts";
import { registerAuth } from "./auth.ts";
import { registerCommentRoutes } from "./comment-routes.ts";
import { resolveProjectRoot } from "./context.ts";
import { registerGraphRoutes } from "./graph-routes.ts";
import { registerRunRoutes } from "./run-routes.ts";
import type { DaemonContext, DaemonHandle, DaemonOptions } from "./types.ts";
import { registerWebSocketRoutes } from "./websocket.ts";

function sessionToken(dataDir: string): string {
  const tokenPath = join(dataDir, "session-token");
  const token = existsSync(tokenPath)
    ? readFileSync(tokenPath, "utf8").trim()
    : randomBytes(24).toString("base64url");

  if (!existsSync(tokenPath)) {
    writeFileSync(tokenPath, token, { mode: 0o600 });
  }

  return token;
}

function registerSystemRoutes(
  app: FastifyInstance,
  context: DaemonContext,
): void {
  app.get("/api/health", async function health() {
    return {
      status: "ok",
      host: context.host,
      approvalBoundary: "human_required",
    };
  });

  app.get("/api/session", async function session() {
    return { token: context.token };
  });
}

async function registerDashboard(
  app: FastifyInstance,
  webDist: string,
): Promise<void> {
  if (!existsSync(webDist)) {
    return;
  }

  await app.register(fastifyStatic, {
    root: webDist,
    // Keep wildcard matching so Vite-hashed assets work after rebuild
    // without restarting graphd.
    wildcard: true,
  });

  app.setNotFoundHandler(async function serveDashboardFallback(request, reply) {
    const path = request.url.split("?")[0] ?? "";
    const isDashboardRoute =
      request.raw.method === "GET" &&
      !path.startsWith("/api") &&
      !path.startsWith("/ws") &&
      !isStaticAssetPath(path);

    if (isDashboardRoute) {
      return reply.sendFile("index.html");
    }

    return reply.code(404).send({ error: "NOT_FOUND" });
  });
}

function isStaticAssetPath(path: string): boolean {
  return (
    path.startsWith("/assets/") ||
    /\.(?:js|css|map|json|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|txt|webmanifest)$/i.test(
      path,
    )
  );
}

function resumePersistedRuns(context: DaemonContext): void {
  for (const row of context.store.resumableRuns()) {
    const version = context.store.getGraphVersion(row.graph_version_id);
    if (!version) {
      continue;
    }

    const projectId = context.store.getProjectIdForGraph(row.graph_id);
    void context.runtime.resume(projectId, row.id, version.spec);
  }
}

export async function startDaemon(
  options: DaemonOptions = {},
): Promise<DaemonHandle> {
  const projectRoot = resolveProjectRoot();
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4317;
  const dataDir = options.dataDir ?? join(projectRoot, ".graph-engineer");
  mkdirSync(dataDir, { recursive: true });

  const token = sessionToken(dataDir);
  const store = new EventStore(
    join(dataDir, "graph-engineer.db"),
    join(dataDir, "runs"),
  );
  const runtime = new GraphRuntime(store, createRuntimeAgent());
  const app = Fastify({ logger: false });
  const context: DaemonContext = {
    host,
    port,
    projectRoot,
    token,
    store,
    runtime,
  };

  await app.register(websocket);
  registerAuth(app, token);
  registerSystemRoutes(app, context);
  registerGraphRoutes(app, context);
  registerCommentRoutes(app, context);
  registerRunRoutes(app, context);
  registerAgentRepositoryRoutes(app, context);
  registerWebSocketRoutes(app, context);

  const webDist = options.webDist ?? join(projectRoot, "apps/web/dist");
  await registerDashboard(app, webDist);
  await app.listen({ host, port });
  resumePersistedRuns(context);

  return {
    app,
    store,
    runtime,
    token,
    url: `http://${host}:${port}`,
  };
}
