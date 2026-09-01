import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readTokenFile } from "../../api-client/src/index.ts";
import { startDaemon, type DaemonHandle } from "../../daemon-core/src/index.ts";

const graphdBaseUrl = process.env.GRAPHD_URL ?? "http://127.0.0.1:4317";
const healthTimeoutMs = 2_000;

let sessionToken = process.env.GRAPHD_SESSION_TOKEN ?? "";
let ownedDaemon: DaemonHandle | undefined;
let ensureInFlight: Promise<EnsureDaemonResult> | null = null;

export type EnsureDaemonOptions = {
  /** Close any owned daemon and require a fresh healthy endpoint. */
  forceRestart?: boolean;
};

export type EnsureDaemonResult = {
  baseUrl: string;
  started: boolean;
  status: "ready" | "started";
};

export function getGraphdBaseUrl(): string {
  return graphdBaseUrl;
}

export function getSessionToken(): string {
  return sessionToken;
}

export async function probeDaemonHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${graphdBaseUrl}/api/health`, {
      signal: AbortSignal.timeout(healthTimeoutMs),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Ensure graphd is reachable before planner tools talk to it or open the
 * Dashboard. Safe to call on every tool invocation: cheap when healthy,
 * self-heals when an external graphd died after MCP startup.
 */
export async function ensureDaemon(
  options: EnsureDaemonOptions = {},
): Promise<EnsureDaemonResult> {
  if (ensureInFlight) {
    try {
      await ensureInFlight;
    } catch {
      // Prior attempt failed; fall through and try again.
    }
    if (!options.forceRestart && (await probeDaemonHealth())) {
      const dataDir =
        process.env.GRAPH_ENGINEER_HOME ?? join(homedir(), ".graph");
      await adoptSessionToken(join(dataDir, "session-token"));
      return readyResult(false);
    }
  }

  ensureInFlight = ensureDaemonUnlocked(options).finally(function clearInFlight() {
    ensureInFlight = null;
  });
  return ensureInFlight;
}

async function ensureDaemonUnlocked(
  options: EnsureDaemonOptions,
): Promise<EnsureDaemonResult> {
  const dataDir = process.env.GRAPH_ENGINEER_HOME ?? join(homedir(), ".graph");
  const tokenPath = join(dataDir, "session-token");

  if (!options.forceRestart && (await probeDaemonHealth())) {
    await adoptSessionToken(tokenPath);
    return readyResult(false);
  }

  await stopOwnedDaemon();

  if (await probeDaemonHealth()) {
    await adoptSessionToken(tokenPath);
    return readyResult(false);
  }

  const url = new URL(graphdBaseUrl);
  try {
    ownedDaemon = await startDaemon({
      host: url.hostname,
      port: Number(url.port || 4317),
      dataDir,
      webDist: resolveDashboardPath(),
    });
  } catch (error) {
    if (await probeDaemonHealth()) {
      await adoptSessionToken(tokenPath);
      return readyResult(false);
    }
    throw new Error(
      `Failed to start graphd at ${graphdBaseUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  sessionToken = ownedDaemon.token;

  if (!(await probeDaemonHealth())) {
    throw new Error(
      `graphd started at ${graphdBaseUrl} but /api/health is not reachable`,
    );
  }

  return {
    baseUrl: graphdBaseUrl,
    started: true,
    status: "started",
  };
}

async function adoptSessionToken(tokenPath: string): Promise<void> {
  if (!sessionToken) {
    sessionToken = readTokenFile(tokenPath);
  }
  if (!sessionToken) {
    throw missingSessionTokenError();
  }
}

function readyResult(started: boolean): EnsureDaemonResult {
  return {
    baseUrl: graphdBaseUrl,
    started,
    status: started ? "started" : "ready",
  };
}

async function stopOwnedDaemon(): Promise<void> {
  if (!ownedDaemon) {
    return;
  }

  const handle = ownedDaemon;
  ownedDaemon = undefined;
  try {
    await handle.app.close();
  } catch {
    // Best-effort; a dead listener is the reason we are restarting.
  }
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
