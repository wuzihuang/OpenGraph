import type { GraphSpec, RunState } from "../../contracts/src/index.ts";
import type {
  EventRecord,
  EventRow,
  GraphListRecord,
  GraphListRow,
  GraphVersionRecord,
  GraphVersionRow,
  RunRecord,
  RunRow,
} from "./types.ts";

function parseJson<T>(value: string): T {
  return JSON.parse(value) as unknown as T;
}

export function mapGraphVersionRow(row: GraphVersionRow): GraphVersionRecord {
  return {
    ...row,
    spec: parseJson<GraphSpec>(row.spec),
  };
}

export function mapGraphListRow(row: GraphListRow): GraphListRecord {
  return {
    ...row,
    spec: parseJson<GraphSpec>(row.spec),
  };
}

export function mapRunRow(row: RunRow): RunRecord {
  return {
    ...row,
    state: parseJson<RunState>(row.state),
  };
}

export function mapEventRow(row: EventRow): EventRecord {
  return {
    eventId: row.event_id,
    sequence: row.sequence,
    timestamp: row.timestamp,
    projectId: row.project_id,
    graphId: row.graph_id,
    runId: row.run_id,
    nodeId: row.node_id,
    attempt: row.attempt,
    agentId: row.agent_id,
    agentSessionId: row.agent_session_id,
    type: row.type,
    payload: parseJson<Record<string, unknown>>(row.payload),
  };
}
