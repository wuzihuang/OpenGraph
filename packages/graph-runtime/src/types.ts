import type { GraphSpec, RunState } from "../../contracts/src/index.ts";
import type { EventStore } from "../../event-store/src/index.ts";
import type { ClaudeCodeAgent } from "../../claude-code-agent/src/index.ts";
import type { MockAcpAgent } from "../../mock-acp-agent/src/index.ts";

export type RuntimeAgent = MockAcpAgent | ClaudeCodeAgent;
export type RuntimeEvent = ReturnType<EventStore["appendEvent"]>;
export type RuntimeEventBase = Parameters<EventStore["appendEvent"]>[0];
export type RuntimeListener = (event: RuntimeEvent) => void;
export type EmitRuntimeEvent = (event: RuntimeEventBase) => RuntimeEvent;

export interface GraphExecutionContext {
  projectId: string;
  graphId: string;
  spec: GraphSpec;
  state: RunState;
  signal: AbortSignal;
  store: EventStore;
  agent: RuntimeAgent;
  emit: EmitRuntimeEvent;
  isPaused: () => boolean;
}
