import type { TaskEnvelope } from "../../contracts/src/index.ts";
import type { NodeExecutionContext } from "./node-execution-types.ts";

function createArtifactContent(
  context: NodeExecutionContext,
  envelope: TaskEnvelope,
  outputName: string,
  attempt: number,
  summary: string,
  physicalPassed: boolean,
): object {
  const { node, state } = context;

  if (outputName !== "run-report.json") {
    return {
      nodeId: node.id,
      attempt,
      summary,
    };
  }

  return {
    runId: state.runId,
    status: "completed",
    finalBranch: `graph/${state.runId}/integration`,
    diffs: Object.entries(state.artifactIndex)
      .filter(function isDiffArtifact([name]): boolean {
        return name.startsWith("diff:");
      })
      .map(function formatDiffArtifact([name, value]) {
        return {
          nodeId: name.slice(5),
          ...value,
        };
      }),
    tests: envelope.acceptanceCommands.map(
      function formatCommandResult(command) {
        return {
          command,
          passed: physicalPassed,
        };
      },
    ),
    attempts: state.budgetState.attempts,
  };
}

export function writeOutputArtifacts(
  context: NodeExecutionContext,
  envelope: TaskEnvelope,
  attempt: number,
  summary: string,
  physicalPassed: boolean,
  workerSession: string,
): string[] {
  const { emit, graphId, node, projectId, state, store } = context;
  const artifactNames: string[] = [];

  for (const output of node.outputs) {
    const content = createArtifactContent(
      context,
      envelope,
      output.name,
      attempt,
      summary,
      physicalPassed,
    );
    const artifact = store.writeArtifact(
      state.runId,
      node.id,
      output.name,
      JSON.stringify(content, null, 2),
    );

    state.artifactIndex[output.name] = artifact;
    artifactNames.push(output.name);

    emit({
      projectId,
      graphId,
      runId: state.runId,
      nodeId: node.id,
      attempt,
      agentId: "mock",
      agentSessionId: workerSession,
      type: "artifact.created",
      payload: {
        name: output.name,
        ...artifact,
      },
    });
  }

  return artifactNames;
}
