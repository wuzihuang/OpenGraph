import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  root: text("root").notNull(),
  createdAt: text("created_at").notNull(),
});

export const agentInstallations = sqliteTable("agent_installations", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  probedAt: text("probed_at").notNull(),
});

export const graphSpecs = sqliteTable("graph_specs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const graphVersions = sqliteTable(
  "graph_versions",
  {
    id: text("id").primaryKey(),
    graphId: text("graph_id").notNull(),
    version: integer("version").notNull(),
    spec: text("spec").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("graph_version_unique").on(table.graphId, table.version),
  ],
);

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  graphId: text("graph_id").notNull(),
  graphVersionId: text("graph_version_id").notNull(),
  status: text("status").notNull(),
  state: text("state").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const nodeRuns = sqliteTable("node_runs", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  nodeId: text("node_id").notNull(),
  attempt: integer("attempt").notNull(),
  status: text("status").notNull(),
  sessionId: text("session_id"),
  updatedAt: text("updated_at").notNull(),
});

export const agentSessions = sqliteTable("agent_sessions", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  nodeId: text("node_id").notNull(),
  attempt: integer("attempt").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
});

export const events = sqliteTable(
  "events",
  {
    eventId: text("event_id").primaryKey(),
    sequence: integer("sequence").notNull(),
    timestamp: text("timestamp").notNull(),
    projectId: text("project_id").notNull(),
    graphId: text("graph_id").notNull(),
    runId: text("run_id").notNull(),
    nodeId: text("node_id"),
    attempt: integer("attempt").notNull(),
    agentId: text("agent_id"),
    agentSessionId: text("agent_session_id"),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
  },
  (table) => [
    uniqueIndex("event_run_sequence").on(table.runId, table.sequence),
  ],
);

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  nodeId: text("node_id").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  hash: text("hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  graphVersionId: text("graph_version_id").notNull(),
  runId: text("run_id"),
  decision: text("decision").notNull(),
  actor: text("actor").notNull(),
  createdAt: text("created_at").notNull(),
});

export const migrations = sqliteTable("migrations", {
  version: integer("version").primaryKey(),
  appliedAt: text("applied_at").notNull(),
});
