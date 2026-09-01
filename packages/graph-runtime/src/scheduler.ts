import type { GraphNode } from "../../contracts/src/index.ts";
import { runNode } from "./node-execution.ts";
import type { GraphExecutionContext } from "./types.ts";

const PAUSE_POLL_INTERVAL_MS = 25;

function waitForPausePoll(): Promise<void> {
  return new Promise(function schedulePausePoll(resolve): void {
    setTimeout(resolve, PAUSE_POLL_INTERVAL_MS);
  });
}

function createIncomingNodeIndex(
  context: GraphExecutionContext,
): Map<string, string[]> {
  const { spec } = context;

  return new Map(
    spec.nodes.map(function indexIncomingNodes(node): [string, string[]] {
      const dependencies = spec.edges
        .filter(function targetsNode(edge): boolean {
          return edge.to === node.id;
        })
        .map(function getSourceNode(edge): string {
          return edge.from;
        });

      return [node.id, dependencies];
    }),
  );
}

function getPendingNodes(context: GraphExecutionContext): GraphNode[] {
  const { spec, state } = context;

  return spec.nodes.filter(function isPending(node): boolean {
    return state.nodeIndex[node.id] === "pending";
  });
}

function getReadyNodes(
  context: GraphExecutionContext,
  pendingNodes: GraphNode[],
  incomingNodes: Map<string, string[]>,
): GraphNode[] {
  const { state } = context;

  return pendingNodes.filter(function hasSucceededDependencies(node): boolean {
    const dependencies = incomingNodes.get(node.id) ?? [];

    return dependencies.every(
      function dependencySucceeded(dependency): boolean {
        return state.nodeIndex[dependency] === "succeeded";
      },
    );
  });
}

function markBatchReady(
  context: GraphExecutionContext,
  batch: GraphNode[],
): void {
  const { emit, graphId, projectId, state } = context;

  for (const node of batch) {
    state.nodeIndex[node.id] = "ready";
    emit({
      projectId,
      graphId,
      runId: state.runId,
      nodeId: node.id,
      attempt: 0,
      agentId: "mock",
      agentSessionId: null,
      type: "node.ready",
      payload: {},
    });
  }
}

export async function executeGraph(
  context: GraphExecutionContext,
): Promise<void> {
  const { emit, graphId, isPaused, projectId, signal, spec, state, store } =
    context;
  const incomingNodes = createIncomingNodeIndex(context);

  while (true) {
    if (signal.aborted) {
      return;
    }

    while (isPaused()) {
      await waitForPausePoll();
    }

    const pendingNodes = getPendingNodes(context);

    if (pendingNodes.length === 0) {
      break;
    }

    const readyNodes = getReadyNodes(context, pendingNodes, incomingNodes);

    if (readyNodes.length === 0) {
      throw new Error("NO_READY_NODES");
    }

    const batch = readyNodes.slice(0, spec.policies.maxParallel);
    markBatchReady(context, batch);

    await Promise.all(
      batch.map(async function executeReadyNode(node): Promise<void> {
        await runNode({
          ...context,
          node,
        });
      }),
    );
    store.updateRun(state.runId, "running", state);
  }

  state.finalStatus = "completed";
  store.updateRun(state.runId, "completed", state);
  emit({
    projectId,
    graphId,
    runId: state.runId,
    nodeId: null,
    attempt: 0,
    agentId: null,
    agentSessionId: null,
    type: "run.completed",
    payload: { artifacts: state.artifactIndex },
  });
}
