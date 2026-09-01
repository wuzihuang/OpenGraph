import type { NodeExecutionContext } from "./node-execution-types.ts";

interface VerificationFailure {
  accepted: false;
  sessionId: string;
  reasons: string[];
  checkedArtifacts: string[];
  rejectionKind: "check_failed";
}

function createPhysicalCheckFailure(
  verifierSession: string,
  artifactNames: string[],
): VerificationFailure {
  return {
    accepted: false,
    sessionId: verifierSession,
    reasons: ["Physical acceptance command failed"],
    checkedArtifacts: artifactNames,
    rejectionKind: "check_failed",
  };
}

function emitVerificationFailure(
  context: NodeExecutionContext,
  attempt: number,
  workerSession: string,
  verifierSession: string,
  reasons: string[],
  rejectionKind: "check_failed" | "supervision_rejected",
): void {
  const { emit, graphId, node, projectId, state, store } = context;

  store.upsertNodeRun(
    state.runId,
    node.id,
    attempt,
    "verification_failed",
    workerSession,
  );
  emit({
    projectId,
    graphId,
    runId: state.runId,
    nodeId: node.id,
    attempt,
    agentId: "mock",
    agentSessionId: verifierSession,
    type:
      rejectionKind === "check_failed"
        ? "node.check.failed"
        : "node.supervision.rejected",
    payload: { reasons, rejectionKind },
  });
  emit({
    projectId,
    graphId,
    runId: state.runId,
    nodeId: node.id,
    attempt,
    agentId: "mock",
    agentSessionId: verifierSession,
    type: "node.verification.failed",
    payload: { reasons, rejectionKind },
  });
}

function emitRetryScheduled(
  context: NodeExecutionContext,
  attempt: number,
): void {
  const { emit, graphId, node, projectId, state } = context;

  emit({
    projectId,
    graphId,
    runId: state.runId,
    nodeId: node.id,
    attempt,
    agentId: "mock",
    agentSessionId: null,
    type: "node.retry.scheduled",
    payload: { nextAttempt: attempt + 1 },
  });
}

export async function verifyAttempt(
  context: NodeExecutionContext,
  attempt: number,
  workerSession: string,
  artifactNames: string[],
  physicalPassed: boolean,
): Promise<string | null> {
  const { agent, node, state, store } = context;
  const verifierSession = store.createSession(
    state.runId,
    node.id,
    attempt,
    "verifier",
  );
  const verification = physicalPassed
    ? await agent.verify(node.id, attempt, verifierSession, artifactNames)
    : createPhysicalCheckFailure(verifierSession, artifactNames);

  if (verification.accepted) {
    return verifierSession;
  }

  const rejectionKind =
    verification.rejectionKind ??
    (physicalPassed ? "supervision_rejected" : "check_failed");
  emitVerificationFailure(
    context,
    attempt,
    workerSession,
    verifierSession,
    verification.reasons,
    rejectionKind,
  );

  if (attempt < node.retryPolicy.maxAttempts) {
    emitRetryScheduled(context, attempt);
    return null;
  }

  throw new Error(`GIVE_UP:${node.id}`);
}
