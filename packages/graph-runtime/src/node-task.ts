import type { TaskEnvelope } from "../../contracts/src/index.ts";
import type { NodeExecutionContext, Worktree } from "./node-execution-types.ts";

function isDefinedString(value: string | undefined): value is string {
  return Boolean(value);
}

export function createTaskEnvelope(
  context: NodeExecutionContext,
  attempt: number,
  worktree: Worktree | null,
): TaskEnvelope {
  const { node, spec, state } = context;

  return {
    runId: state.runId,
    nodeId: node.id,
    attempt,
    objective: node.objective,
    workspace: worktree?.path ?? spec.repository.root,
    readGlobs: node.workspace.readGlobs,
    writeGlobs: node.workspace.writeGlobs,
    inputArtifactPaths: node.inputs
      .map(function resolveInputArtifactPath(name): string | undefined {
        return state.artifactIndex[name]?.path;
      })
      .filter(isDefinedString),
    outputContract: node.outputs,
    acceptanceCommands: node.acceptanceChecks
      .filter(function isCommandCheck(check): boolean {
        return check.type === "command" && Boolean(check.command);
      })
      .map(function getCommand(check): string {
        return check.command!;
      }),
    timeoutSeconds: node.timeoutSeconds,
    prohibitedOperations: [
      "git push",
      "deploy",
      "publish",
      "delete",
      "payment",
      "nested subagents",
      "mutate acceptanceCriteria",
      "weaken acceptanceChecks",
      "edit frozen evaluation fixtures",
    ],
  };
}
