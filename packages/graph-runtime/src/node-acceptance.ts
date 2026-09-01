import { execa } from "execa";
import type { TaskEnvelope } from "../../contracts/src/index.ts";
import { safeEnvironment } from "../../acp-client/src/index.ts";
import { splitCommand } from "./command-parsing.ts";
import type { NodeExecutionContext, Worktree } from "./node-execution-types.ts";

export async function runAcceptanceCommands(
  context: NodeExecutionContext,
  envelope: TaskEnvelope,
  worktree: Worktree | null,
  attempt: number,
  initiallyPassed: boolean,
): Promise<boolean> {
  const { emit, graphId, node, projectId, spec, state } = context;
  let physicalPassed = initiallyPassed;

  for (const command of envelope.acceptanceCommands) {
    const [binary, ...args] = splitCommand(command);

    if (!binary) {
      physicalPassed = false;
      continue;
    }

    const check = await execa(binary, args, {
      cwd: worktree?.path ?? spec.repository.root,
      env: safeEnvironment(),
      timeout: node.timeoutSeconds * 1_000,
      reject: false,
    });

    emit({
      projectId,
      graphId,
      runId: state.runId,
      nodeId: node.id,
      attempt,
      agentId: "physical-check",
      agentSessionId: null,
      type: "agent.terminal.delta",
      payload: {
        delta: `$ ${command}\n${check.stdout}\n${check.stderr}`,
      },
    });

    if (check.exitCode !== 0) {
      physicalPassed = false;
    }
  }

  return physicalPassed;
}
