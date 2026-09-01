import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import type { GraphSpec } from "../../contracts/src/index.ts";
import { EventStore } from "../../event-store/src/index.ts";
import { MockAcpAgent } from "../../mock-acp-agent/src/index.ts";
import { safeEnvironment } from "../../acp-client/src/index.ts";
import { splitCommand } from "./command-parsing.ts";
import { GraphRuntime } from "./graph-runtime.ts";

const DEFAULT_SHADOW_TIMEOUT_MS = 90_000;
const SHADOW_NODE_TIMEOUT_CAP_SECONDS = 30;
const SHADOW_PASS_COMMAND = `${process.execPath} -e "process.exit(0)"`;

export type ShadowCertification = {
  ok: boolean;
  mode: "mock_shadow";
  status: string;
  durationMs: number;
  error?: string;
  failedNodes?: string[];
  missingBinaries?: string[];
};

async function probeCommandBinaries(spec: GraphSpec): Promise<string[]> {
  const binaries = new Set<string>();

  for (const node of spec.nodes) {
    for (const check of node.acceptanceChecks) {
      if (check.type !== "command" || !check.command) {
        continue;
      }

      const [binary] = splitCommand(check.command);
      if (binary) {
        binaries.add(binary);
      }
    }
  }

  const missing: string[] = [];

  for (const binary of binaries) {
    if (binary.includes("/") || binary.includes("\\")) {
      continue;
    }

    const result = await execa("which", [binary], {
      env: safeEnvironment(),
      reject: false,
    });

    if (result.exitCode !== 0) {
      missing.push(binary);
    }
  }

  return missing;
}

function prepareShadowSpec(spec: GraphSpec, shadowRepoRoot: string): GraphSpec {
  return {
    ...spec,
    repository: {
      ...spec.repository,
      root: shadowRepoRoot,
    },
    policies: {
      ...spec.policies,
      maxRuntimeSeconds: Math.min(spec.policies.maxRuntimeSeconds, 120),
    },
    nodes: spec.nodes.map(function softenNode(node) {
      return {
        ...node,
        timeoutSeconds: Math.min(
          node.timeoutSeconds,
          SHADOW_NODE_TIMEOUT_CAP_SECONDS,
        ),
        acceptanceChecks: node.acceptanceChecks.map(function softenCheck(check) {
          if (check.type === "command" && check.command) {
            return {
              ...check,
              command: SHADOW_PASS_COMMAND,
              description: `shadow soft-check for: ${check.command}`,
            };
          }

          return check;
        }),
      };
    }),
  };
}

async function cloneShadowRepository(sourceRoot: string): Promise<string> {
  const shadowRoot = await mkdtemp(join(tmpdir(), "graph-shadow-"));
  // --no-hardlinks: /tmp is often a separate tmpfs from $HOME; plain
  // `git clone --local` hardlinks fail with "Invalid cross-device link".
  const clone = await execa(
    "git",
    ["clone", "--local", "--no-hardlinks", "--quiet", sourceRoot, shadowRoot],
    {
      env: safeEnvironment(),
      reject: false,
    },
  );

  if (clone.exitCode !== 0) {
    await rm(shadowRoot, { recursive: true, force: true });
    throw new Error(
      `SHADOW_CLONE_FAILED:${clone.stderr.trim() || clone.stdout.trim() || "git clone failed"}`,
    );
  }

  return shadowRoot;
}

function failedNodesFromState(
  nodeIndex: Record<string, string>,
): string[] | undefined {
  const failed = Object.entries(nodeIndex)
    .filter(function isFailed([, status]): boolean {
      return status !== "succeeded" && status !== "pending";
    })
    .map(function nodeId([id]): string {
      return id;
    });

  return failed.length > 0 ? failed : undefined;
}

/**
 * Prior mock walk of the compiled LangGraph: certifies that scheduling,
 * worktrees, artifact handoff, and verifier sessions can complete. Softens
 * business acceptance commands after probing binaries so mock output is not
 * judged as the real goal. Never approves the user's draft version.
 */
export async function runShadowCertification(
  spec: GraphSpec,
  options: { timeoutMs?: number } = {},
): Promise<ShadowCertification> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHADOW_TIMEOUT_MS;
  const missingBinaries = await probeCommandBinaries(spec);

  if (missingBinaries.length > 0) {
    return {
      ok: false,
      mode: "mock_shadow",
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: "MISSING_ACCEPTANCE_BINARIES",
      missingBinaries,
    };
  }

  let shadowRoot: string | undefined;
  let dataDir: string | undefined;
  let store: EventStore | undefined;

  try {
    shadowRoot = await cloneShadowRepository(spec.repository.root);
    const shadowSpec = prepareShadowSpec(spec, shadowRoot);
    dataDir = await mkdtemp(join(tmpdir(), "graph-shadow-db-"));
    store = new EventStore(join(dataDir, "shadow.sqlite"), join(dataDir, "runs"));

    const projectId = store.createProject(shadowRoot);
    const published = store.publishGraph(projectId, shadowSpec);
    store.approve(published.graphVersionId, "shadow-certifier");

    const runtime = new GraphRuntime(store, new MockAcpAgent());
    const result = await runtime.startAndAwait(
      projectId,
      published.graphId,
      published.graphVersionId,
      shadowSpec,
      `run_shadow_${Date.now()}`,
      timeoutMs,
    );

    const ok = result.status === "completed";

    if (ok) {
      return {
        ok: true,
        mode: "mock_shadow",
        status: result.status,
        durationMs: Date.now() - startedAt,
      };
    }

    const failedNodes = failedNodesFromState(result.state.nodeIndex);
    return {
      ok: false,
      mode: "mock_shadow",
      status: result.status,
      durationMs: Date.now() - startedAt,
      error: result.error ?? `SHADOW_STATUS_${result.status}`,
      ...(failedNodes ? { failedNodes } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      mode: "mock_shadow",
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: message,
    };
  } finally {
    store?.close();

    if (shadowRoot) {
      await rm(shadowRoot, { recursive: true, force: true });
    }

    if (dataDir) {
      await rm(dataDir, { recursive: true, force: true });
    }
  }
}
