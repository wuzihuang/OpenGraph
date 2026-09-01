import type { NodeResult, TaskEnvelope } from "../../contracts/src/index.ts";
import { normalizeAcpUpdate } from "../../acp-client/src/index.ts";
import { WorktreeManager } from "../../worktree-manager/src/index.ts";
import { runAcceptanceCommands } from "./node-acceptance.ts";
import { writeOutputArtifacts } from "./node-artifacts.ts";
import type { NodeExecutionContext, Worktree } from "./node-execution-types.ts";
import { createTaskEnvelope } from "./node-task.ts";
import { verifyAttempt } from "./node-verification.ts";
import {
  collectWorktreeEvidence,
  commitSuccessfulWorktree,
  createNodeWorktree,
  integrateExistingCommits,
} from "./node-worktree.ts";

function startAttempt(context: NodeExecutionContext, attempt: number): string {
  const { emit, graphId, node, projectId, state, store } = context;

  state.budgetState.attempts += 1;
  const workerSession = store.createSession(
    state.runId,
    node.id,
    attempt,
    "worker",
  );

  state.nodeIndex[node.id] = "running";
  store.upsertNodeRun(state.runId, node.id, attempt, "running", workerSession);
  emit({
    projectId,
    graphId,
    runId: state.runId,
    nodeId: node.id,
    attempt,
    agentId: "mock",
    agentSessionId: workerSession,
    type: "node.status",
    payload: { status: "running" },
  });

  return workerSession;
}

async function executeWorker(
  context: NodeExecutionContext,
  envelope: TaskEnvelope,
  attempt: number,
  workerSession: string,
): Promise<NodeResult> {
  const { agent, emit, graphId, node, projectId, signal, state } = context;
  const timeout = AbortSignal.timeout(node.timeoutSeconds * 1_000);
  const combinedSignal = AbortSignal.any([signal, timeout]);

  return agent.execute(
    envelope,
    workerSession,
    function emitAgentUpdate(update): void {
      const normalized = normalizeAcpUpdate(update);

      emit({
        projectId,
        graphId,
        runId: state.runId,
        nodeId: node.id,
        attempt,
        agentId: "mock",
        agentSessionId: workerSession,
        ...normalized,
      });
    },
    combinedSignal,
  );
}

function emitCheckStarted(
  context: NodeExecutionContext,
  envelope: TaskEnvelope,
  attempt: number,
  workerSession: string,
): void {
  const { emit, graphId, node, projectId, state } = context;

  emit({
    projectId,
    graphId,
    runId: state.runId,
    nodeId: node.id,
    attempt,
    agentId: "mock",
    agentSessionId: workerSession,
    type: "node.check.started",
    payload: { commands: envelope.acceptanceCommands },
  });
}

function emitCheckCompleted(
  context: NodeExecutionContext,
  attempt: number,
  workerSession: string,
  physicalPassed: boolean,
): void {
  const { emit, graphId, node, projectId, state } = context;

  emit({
    projectId,
    graphId,
    runId: state.runId,
    nodeId: node.id,
    attempt,
    agentId: "mock",
    agentSessionId: workerSession,
    type: "node.check.completed",
    payload: { passed: physicalPassed },
  });
}

async function runPhysicalChecks(
  context: NodeExecutionContext,
  manager: WorktreeManager,
  envelope: TaskEnvelope,
  worktree: Worktree | null,
  attempt: number,
  workerSession: string,
): Promise<boolean> {
  emitCheckStarted(context, envelope, attempt, workerSession);
  const worktreePassed = await collectWorktreeEvidence(
    context,
    manager,
    worktree,
    attempt,
  );
  const physicalPassed = await runAcceptanceCommands(
    context,
    envelope,
    worktree,
    attempt,
    worktreePassed,
  );
  emitCheckCompleted(context, attempt, workerSession, physicalPassed);

  return physicalPassed;
}

async function markAttemptSucceeded(
  context: NodeExecutionContext,
  manager: WorktreeManager,
  worktree: Worktree | null,
  attempt: number,
  workerSession: string,
  verifierSession: string,
): Promise<void> {
  const { emit, graphId, node, projectId, state, store } = context;

  await commitSuccessfulWorktree(context, manager, worktree, attempt);
  state.nodeIndex[node.id] = "succeeded";
  store.upsertNodeRun(
    state.runId,
    node.id,
    attempt,
    "succeeded",
    workerSession,
  );
  store.updateRun(state.runId, "running", state);
  emit({
    projectId,
    graphId,
    runId: state.runId,
    nodeId: node.id,
    attempt,
    agentId: "mock",
    agentSessionId: workerSession,
    type: "node.status",
    payload: {
      status: "succeeded",
      verifierSession,
    },
  });
}

async function runAttempt(
  context: NodeExecutionContext,
  manager: WorktreeManager,
  worktree: Worktree | null,
  attempt: number,
): Promise<boolean> {
  const workerSession = startAttempt(context, attempt);
  const envelope = createTaskEnvelope(context, attempt, worktree);
  const result = await executeWorker(context, envelope, attempt, workerSession);

  if (result.status === "cancelled") {
    throw new Error("NODE_CANCELLED");
  }

  const physicalPassed = await runPhysicalChecks(
    context,
    manager,
    envelope,
    worktree,
    attempt,
    workerSession,
  );
  const artifactNames = writeOutputArtifacts(
    context,
    envelope,
    attempt,
    result.summary,
    physicalPassed,
    workerSession,
  );
  const verifierSession = await verifyAttempt(
    context,
    attempt,
    workerSession,
    artifactNames,
    physicalPassed,
  );

  if (!verifierSession) {
    return false;
  }

  await markAttemptSucceeded(
    context,
    manager,
    worktree,
    attempt,
    workerSession,
    verifierSession,
  );
  return true;
}

export async function runNode(context: NodeExecutionContext): Promise<void> {
  const { node, spec } = context;
  const manager = new WorktreeManager(spec.repository.root);
  const worktree = await createNodeWorktree(context, manager);

  await integrateExistingCommits(context, manager, worktree);

  for (let attempt = 1; attempt <= node.retryPolicy.maxAttempts; attempt += 1) {
    const succeeded = await runAttempt(context, manager, worktree, attempt);

    if (succeeded) {
      return;
    }
  }
}
