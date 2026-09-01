import { mkdirSync } from "node:fs";
import {
  discoverAgents,
  discoverEnvironment,
} from "../../../../packages/agent-registry/src/index.ts";
import { inspectRepository } from "../../../../packages/repo-intelligence/src/index.ts";
import type { CliContext } from "../context.ts";

interface HealthResponse {
  status: string;
}

export function initializeState(context: CliContext): void {
  mkdirSync(context.dataDir, { recursive: true });
  console.log(`Initialized ${context.dataDir}`);
}

export async function inspectEnvironment(context: CliContext): Promise<void> {
  const environment = await discoverEnvironment();
  const repository = await inspectRepository(process.cwd());
  let daemon = "offline";

  try {
    const response = await fetch(`${context.baseUrl}/api/health`);
    const health = (await response.json()) as HealthResponse;
    daemon = health.status;
  } catch {
    // An unavailable or invalid health endpoint is reported as offline.
  }

  console.log(
    JSON.stringify(
      {
        daemon,
        repository: {
          root: repository.root,
          dirty: repository.git.dirty,
          packageManager: repository.packageManager,
        },
        ...environment,
      },
      null,
      2,
    ),
  );
}

export async function listAgents(): Promise<void> {
  console.log(JSON.stringify(await discoverAgents(), null, 2));
}
