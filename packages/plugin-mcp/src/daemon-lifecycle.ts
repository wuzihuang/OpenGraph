import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readTokenFile } from "../../api-client/src/index.ts";
import { startDaemon, type DaemonHandle } from "../../daemon-core/src/index.ts";

const graphdBaseUrl = process.env.GRAPHD_URL ?? "http://127.0.0.1:4317";
let sessionToken = process.env.GRAPHD_SESSION_TOKEN ?? "";
let ownedDaemon: DaemonHandle | undefined;

export function getGraphdBaseUrl(): string {
  return graphdBaseUrl;
}

export function getSessionToken(): string {
  return sessionToken;
}

export async function ensureDaemon(): Promise<void> {
  const dataDir = process.env.GRAPH_ENGINEER_HOME ?? join(homedir(), ".graph");
  const tokenPath = join(dataDir, "session-token");

  try {
    const response = await fetch(`${graphdBaseUrl}/api/health`);
    if (response.ok) {
      if (!sessionToken) {
        sessionToken = readTokenFile(tokenPath);
      }
      if (!sessionToken) {
        throw missingSessionTokenError();
      }
      return;
    }
  } catch (error) {
    if (isMissingSessionTokenError(error)) {
      throw error;
    }
  }

  const url = new URL(graphdBaseUrl);
  const webDist = resolveDashboardPath();
  ownedDaemon = await startDaemon({
    host: url.hostname,
    port: Number(url.port || 4317),
    dataDir,
    webDist,
  });
  sessionToken = ownedDaemon.token;
}

function resolveDashboardPath(): string {
  const runtimeRoot = process.env.GRAPH_PLUGIN_ROOT
    ? join(process.env.GRAPH_PLUGIN_ROOT, "runtime")
    : dirname(fileURLToPath(import.meta.url));
  const bundledDashboard = join(runtimeRoot, "dashboard");
  const sourceDashboard = join(
    runtimeRoot,
    "..",
    "..",
    "..",
    "apps",
    "web",
    "dist",
  );
  return existsSync(bundledDashboard) ? bundledDashboard : sourceDashboard;
}

function missingSessionTokenError(): Error {
  return new Error(
    `Graph is already running at ${graphdBaseUrl}, but its session token is unavailable. Set GRAPHD_SESSION_TOKEN or stop that process.`,
  );
}

function isMissingSessionTokenError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message.includes("session token is unavailable")
  );
}
