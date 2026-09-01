import { randomUUID } from "node:crypto";
import type { GraphSpec, RunState } from "../../contracts/src/index.ts";
import { compileGraphSpec } from "../../graph-compiler/src/index.ts";
import { EventStore } from "../../event-store/src/index.ts";
import { ClaudeCodeAgent } from "../../claude-code-agent/src/index.ts";
import { MockAcpAgent } from "../../mock-acp-agent/src/index.ts";
import { executeGraph } from "./scheduler.ts";
import type {
  RuntimeAgent,
  RuntimeEvent,
  RuntimeEventBase,
  RuntimeListener,
} from "./types.ts";

export function createRuntimeAgent(
  preference = process.env.OPENGRAPH_AGENT ?? "mock",
): RuntimeAgent {
  const normalized = preference.trim().toLowerCase();
  if (
    normalized === "claude" ||
    normalized === "claude-code" ||
    normalized === "claude_code"
  ) {
    return new ClaudeCodeAgent();
  }
  return new MockAcpAgent();
}

function createInitialRunState(
  runId: string,
  graphVersionId: string,
  spec: GraphSpec,
): RunState {
  return {
    runId,
    graphVersion: graphVersionId,
    repoRef: spec.repository.baseRef,
    nodeIndex: Object.fromEntries(
      spec.nodes.map(function createPendingNodeEntry(node): [string, string] {
        return [node.id, "pending"];
      }),
    ),
    artifactIndex: {},
    budgetState: {
      startedAt: new Date().toISOString(),
      attempts: 0,
    },
    decisionFlags: {
      approved: true,
    },
    finalStatus: "running",
  };
}

function resetInterruptedNodes(state: RunState, spec: GraphSpec): void {
  const interruptedStatuses = ["running", "ready", "retrying"];

  for (const node of spec.nodes) {
    if (interruptedStatuses.includes(state.nodeIndex[node.id]!)) {
      state.nodeIndex[node.id] = "pending";
    }
  }
}

function markPendingNodesCancelled(state: RunState): void {
  const cancellableStatuses = ["pending", "ready", "running"];

  for (const nodeId of Object.keys(state.nodeIndex)) {
    if (cancellableStatuses.includes(state.nodeIndex[nodeId]!)) {
      state.nodeIndex[nodeId] = "cancelled";
    }
  }
}

export class GraphRuntime {
  private readonly aborters = new Map<string, AbortController>();
  private readonly paused = new Set<string>();
  private readonly listeners = new Set<RuntimeListener>();

  constructor(
    readonly store: EventStore,
    readonly agent: RuntimeAgent = createRuntimeAgent(),
  ) {}

  subscribe(listener: RuntimeListener): () => boolean {
    this.listeners.add(listener);
    const listeners = this.listeners;

    return function unsubscribe(): boolean {
      return listeners.delete(listener);
    };
  }

  isActive(runId: string): boolean {
    return this.aborters.has(runId);
  }

  private emit(base: RuntimeEventBase): RuntimeEvent {
    const event = this.store.appendEvent(base);

    for (const listener of this.listeners) {
      listener(event);
    }

    return event;
  }

  async start(
    projectId: string,
    graphId: string,
    graphVersionId: string,
    spec: GraphSpec,
    runId = `run_${randomUUID()}`,
  ): Promise<string> {
    const state = this.beginRun(
      projectId,
      graphId,
      graphVersionId,
      spec,
      runId,
    );
    void this.execute(projectId, graphId, spec, state);
    return runId;
  }

  /**
   * Start a run and wait until it reaches a terminal status (or timeout).
   * Used by shadow certification; production approve path stays fire-and-forget.
   */
  async startAndAwait(
    projectId: string,
    graphId: string,
    graphVersionId: string,
    spec: GraphSpec,
    runId = `run_${randomUUID()}`,
    timeoutMs = 90_000,
  ): Promise<{
    runId: string;
    status: string;
    state: RunState;
    error?: string;
  }> {
    const state = this.beginRun(
      projectId,
      graphId,
      graphVersionId,
      spec,
      runId,
    );
    let timedOut = false;
    const timeoutTimer = setTimeout((): void => {
      timedOut = true;
      this.cancel(runId);
    }, timeoutMs);

    try {
      await this.execute(projectId, graphId, spec, state);
    } finally {
      clearTimeout(timeoutTimer);
    }

    const row = this.store.getRun(runId);

    if (!row) {
      throw new Error("Run not found after shadow execution");
    }

    if (timedOut) {
      return {
        runId,
        status: row.status,
        state: row.state,
        error: "SHADOW_TIMEOUT",
      };
    }

    if (row.status === "completed") {
      return {
        runId,
        status: row.status,
        state: row.state,
      };
    }

    return {
      runId,
      status: row.status,
      state: row.state,
      error: String(row.state.finalStatus),
    };
  }

  private beginRun(
    projectId: string,
    graphId: string,
    graphVersionId: string,
    spec: GraphSpec,
    runId: string,
  ): RunState {
    compileGraphSpec(spec, async function createCompileContext() {
      return {};
    });

    const state = createInitialRunState(runId, graphVersionId, spec);

    this.store.createRun(graphId, graphVersionId, state);
    this.emit({
      projectId,
      graphId,
      runId,
      nodeId: null,
      attempt: 0,
      agentId: null,
      agentSessionId: null,
      type: "graph.status",
      payload: { status: "running" },
    });

    return state;
  }

  async resume(
    projectId: string,
    runId: string,
    spec: GraphSpec,
  ): Promise<string> {
    const row = this.store.getRun(runId);

    if (!row) {
      throw new Error("Run not found");
    }

    resetInterruptedNodes(row.state, spec);
    row.state.finalStatus = "running";
    this.store.updateRun(runId, "running", row.state);
    void this.execute(projectId, row.graph_id, spec, row.state);

    return runId;
  }

  pause(runId: string): void {
    this.paused.add(runId);

    const row = this.store.getRun(runId);

    if (row) {
      this.store.updateRun(runId, "paused", {
        ...row.state,
        finalStatus: "paused",
      });
    }
  }

  resumePaused(runId: string): void {
    this.paused.delete(runId);
  }

  retryNode(runId: string, nodeId: string): void {
    const row = this.store.getRun(runId);

    if (!row) {
      throw new Error("Run not found");
    }

    row.state.nodeIndex[nodeId] = "pending";
    row.state.finalStatus = "running";
    this.store.updateRun(runId, "running", row.state);
  }

  reassign(runId: string, nodeId: string, agentId: string): void {
    const row = this.store.getRun(runId);

    if (!row) {
      throw new Error("Run not found");
    }

    row.state.decisionFlags[`agent:${nodeId}`] = agentId;
    this.store.updateRun(runId, row.status, row.state);
  }

  cancel(runId: string): void {
    this.aborters.get(runId)?.abort();

    const row = this.store.getRun(runId);

    if (row) {
      const state = {
        ...row.state,
        finalStatus: "cancelled",
      };

      markPendingNodesCancelled(state);
      this.store.updateRun(runId, "cancelled", state);
    }
  }

  private async execute(
    projectId: string,
    graphId: string,
    spec: GraphSpec,
    state: RunState,
  ): Promise<void> {
    const controller = new AbortController();
    const pausedRuns = this.paused;

    this.aborters.set(state.runId, controller);

    function isPaused(): boolean {
      return pausedRuns.has(state.runId);
    }

    try {
      await executeGraph({
        projectId,
        graphId,
        spec,
        state,
        signal: controller.signal,
        store: this.store,
        agent: this.agent,
        emit: this.emit.bind(this),
        isPaused,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      state.finalStatus = "failed";
      this.store.updateRun(state.runId, "failed", state);
      this.emit({
        projectId,
        graphId,
        runId: state.runId,
        nodeId: null,
        attempt: 0,
        agentId: null,
        agentSessionId: null,
        type: "run.failed",
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } finally {
      this.aborters.delete(state.runId);
    }
  }
}
