import type {
  GraphSpec,
  NormalizedRunEvent,
  RunEventType,
  RunState,
} from "../../contracts/src/index.ts";

export interface Migration {
  version: number;
  sql: string;
}

export interface MigrationVersionRow {
  version: number;
}

export interface GraphVersionNumberRow {
  version: number;
}

export interface GraphVersionStatusRow {
  status: string;
}

export interface GraphProjectRow {
  project_id: string;
}

export interface GraphVersionRow {
  id: string;
  graph_id: string;
  version: number;
  spec: string;
  status: string;
  created_at: string;
}

export interface GraphListRow {
  id: string;
  version: number;
  status: string;
  created_at: string;
  spec: string;
}

export interface RunRow {
  id: string;
  graph_id: string;
  graph_version_id: string;
  status: string;
  state: string;
  created_at: string;
  updated_at: string;
  resumed_count: number;
}

export interface EventRow {
  event_id: string;
  sequence: number;
  timestamp: string;
  project_id: string;
  graph_id: string;
  run_id: string;
  node_id: string | null;
  attempt: number;
  agent_id: string | null;
  agent_session_id: string | null;
  type: RunEventType;
  payload: string;
}

export type GraphVersionRecord = Omit<GraphVersionRow, "spec"> & {
  spec: GraphSpec;
};

export type GraphListRecord = Omit<GraphListRow, "spec"> & {
  spec: GraphSpec;
};

export type RunRecord = Omit<RunRow, "state"> & {
  state: RunState;
};

export interface AppendEventInput {
  projectId: string;
  graphId: string;
  runId: string;
  nodeId: string | null;
  attempt: number;
  agentId: string | null;
  agentSessionId: string | null;
  type: RunEventType;
  payload: Record<string, unknown>;
}

export type EventRecord = NormalizedRunEvent;

export interface PublishedGraph {
  graphId: string;
  graphVersion: number;
  graphVersionId: string;
}

export interface AmendedGraph {
  graphVersion: number;
  graphVersionId: string;
}

export interface ArtifactRecord {
  path: string;
  hash: string;
}
