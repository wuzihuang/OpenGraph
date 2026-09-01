import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  GraphSpec,
  NormalizedRunEvent,
  RunState,
} from "../../contracts/src/index.ts";
import { applyMigrations } from "./migrations.ts";
import {
  mapEventRow,
  mapGraphListRow,
  mapGraphVersionRow,
  mapRunRow,
} from "./row-mappers.ts";
import type {
  AmendedGraph,
  AppendEventInput,
  ArtifactRecord,
  EventRow,
  GraphListRecord,
  GraphListRow,
  GraphProjectRow,
  GraphVersionNumberRow,
  GraphVersionRecord,
  GraphVersionRow,
  GraphVersionStatusRow,
  NodeCommentRecord,
  PublishedGraph,
  RunRecord,
  RunRow,
} from "./types.ts";

export class EventStore {
  readonly db: Database.Database;
  readonly root: string;

  constructor(dbPath: string, root = join(dirname(dbPath), "runs")) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.root = root;
    mkdirSync(root, { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  migrate(): void {
    applyMigrations(this.db);
  }

  createProject(root: string): string {
    const id = `project_${randomUUID()}`;
    this.db
      .prepare("INSERT INTO projects VALUES(?,?,?)")
      .run(id, root, new Date().toISOString());
    return id;
  }

  publishGraph(projectId: string, spec: GraphSpec): PublishedGraph {
    const graphId = `graph_${randomUUID()}`;
    const versionId = `${graphId}:1`;
    const now = new Date().toISOString();
    const publish = this.db.transaction(() => {
      this.db
        .prepare("INSERT INTO graph_specs VALUES(?,?,?)")
        .run(graphId, projectId, now);
      this.db
        .prepare(
          "INSERT INTO graph_versions(id,graph_id,version,spec,status,created_at) VALUES(?,?,?,?,?,?)",
        )
        .run(versionId, graphId, 1, JSON.stringify(spec), "draft", now);
    });

    publish();
    return { graphId, graphVersion: 1, graphVersionId: versionId };
  }

  amendGraph(graphId: string, spec: GraphSpec): AmendedGraph {
    const row = this.db
      .prepare(
        "SELECT COALESCE(MAX(version),0)+1 AS version FROM graph_versions WHERE graph_id=?",
      )
      .get(graphId) as GraphVersionNumberRow;
    const id = `${graphId}:${row.version}`;

    this.db
      .prepare(
        "INSERT INTO graph_versions(id,graph_id,version,spec,status,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        id,
        graphId,
        row.version,
        JSON.stringify(spec),
        "draft",
        new Date().toISOString(),
      );

    return { graphVersion: row.version, graphVersionId: id };
  }

  getGraph(graphId: string): GraphVersionRecord | null {
    const row = this.db
      .prepare(
        "SELECT * FROM graph_versions WHERE graph_id=? ORDER BY version DESC LIMIT 1",
      )
      .get(graphId) as GraphVersionRow | undefined;

    return row ? mapGraphVersionRow(row) : null;
  }

  getGraphVersion(graphVersionId: string): GraphVersionRecord | null {
    const row = this.db
      .prepare("SELECT * FROM graph_versions WHERE id=?")
      .get(graphVersionId) as GraphVersionRow | undefined;

    return row ? mapGraphVersionRow(row) : null;
  }

  getProjectIdForGraph(graphId: string): string {
    const row = this.db
      .prepare("SELECT project_id FROM graph_specs WHERE id=?")
      .get(graphId) as GraphProjectRow | undefined;

    if (!row) {
      throw new Error(`Graph not found: ${graphId}`);
    }

    return row.project_id;
  }

  listGraphs(): GraphListRecord[] {
    const rows = this.db
      .prepare(
        "SELECT gs.id,gv.version,gv.status,gv.created_at,gv.spec FROM graph_specs gs JOIN graph_versions gv ON gv.graph_id=gs.id WHERE gv.version=(SELECT MAX(version) FROM graph_versions WHERE graph_id=gs.id) ORDER BY gv.created_at DESC",
      )
      .all() as GraphListRow[];

    return rows.map(mapGraphListRow);
  }

  approve(graphVersionId: string, actor = "local-human"): void {
    const row = this.db
      .prepare("SELECT status FROM graph_versions WHERE id=?")
      .get(graphVersionId) as GraphVersionStatusRow | undefined;

    if (!row) {
      throw new Error("Graph version not found");
    }

    this.db
      .prepare("UPDATE graph_versions SET status=? WHERE id=?")
      .run("approved", graphVersionId);
    this.db
      .prepare("INSERT INTO approvals VALUES(?,?,?,?,?,?)")
      .run(
        `approval_${randomUUID()}`,
        graphVersionId,
        null,
        "approved",
        actor,
        new Date().toISOString(),
      );
  }

  reject(graphVersionId: string, actor = "local-human"): void {
    this.db
      .prepare("UPDATE graph_versions SET status=? WHERE id=?")
      .run("rejected", graphVersionId);
    this.db
      .prepare("INSERT INTO approvals VALUES(?,?,?,?,?,?)")
      .run(
        `approval_${randomUUID()}`,
        graphVersionId,
        null,
        "rejected",
        actor,
        new Date().toISOString(),
      );
  }

  createRun(graphId: string, graphVersionId: string, state: RunState): string {
    const version = this.db
      .prepare("SELECT status FROM graph_versions WHERE id=?")
      .get(graphVersionId) as GraphVersionStatusRow | undefined;

    if (version?.status !== "approved") {
      throw new Error("APPROVAL_REQUIRED");
    }

    const id = state.runId;
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT INTO runs(id,graph_id,graph_version_id,status,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        id,
        graphId,
        graphVersionId,
        "pending",
        JSON.stringify(state),
        now,
        now,
      );
    return id;
  }

  updateRun(runId: string, status: string, state: RunState): void {
    this.db
      .prepare("UPDATE runs SET status=?,state=?,updated_at=? WHERE id=?")
      .run(status, JSON.stringify(state), new Date().toISOString(), runId);
  }

  getRun(runId: string): RunRecord | null {
    const row = this.db.prepare("SELECT * FROM runs WHERE id=?").get(runId) as
      RunRow | undefined;

    return row ? mapRunRow(row) : null;
  }

  listRunsForGraph(graphId: string, limit = 20): RunRecord[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM runs WHERE graph_id=? ORDER BY created_at DESC LIMIT ?",
      )
      .all(graphId, limit) as RunRow[];
    return rows.map(mapRunRow);
  }

  resumableRuns(): RunRecord[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM runs WHERE status IN ('pending','running','paused')",
      )
      .all() as RunRow[];

    return rows.map(mapRunRow);
  }

  upsertNodeRun(
    runId: string,
    nodeId: string,
    attempt: number,
    status: string,
    sessionId: string | null = null,
  ): void {
    const id = `${runId}:${nodeId}:${attempt}`;
    this.db
      .prepare(
        "INSERT INTO node_runs(id,run_id,node_id,attempt,status,session_id,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(run_id,node_id,attempt) DO UPDATE SET status=excluded.status,session_id=excluded.session_id,updated_at=excluded.updated_at",
      )
      .run(
        id,
        runId,
        nodeId,
        attempt,
        status,
        sessionId,
        new Date().toISOString(),
      );
  }

  createSession(
    runId: string,
    nodeId: string,
    attempt: number,
    role: "worker" | "verifier",
  ): string {
    const id = `session_${randomUUID()}`;
    this.db
      .prepare("INSERT INTO agent_sessions VALUES(?,?,?,?,?,?)")
      .run(id, runId, nodeId, attempt, role, "active");
    return id;
  }

  appendEvent(base: AppendEventInput): NormalizedRunEvent {
    const append = this.db.transaction(() => {
      const row = this.db
        .prepare(
          "SELECT COALESCE(MAX(sequence),0)+1 AS sequence FROM events WHERE run_id=?",
        )
        .get(base.runId) as { sequence: number };
      const event: NormalizedRunEvent = {
        eventId: `event_${randomUUID()}`,
        sequence: row.sequence,
        timestamp: new Date().toISOString(),
        ...base,
      };

      this.db
        .prepare("INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(
          event.eventId,
          event.sequence,
          event.timestamp,
          event.projectId,
          event.graphId,
          event.runId,
          event.nodeId,
          event.attempt,
          event.agentId,
          event.agentSessionId,
          event.type,
          JSON.stringify(event.payload),
        );

      return event;
    });

    return append();
  }

  eventsAfter(runId: string, sequence = 0): NormalizedRunEvent[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM events WHERE run_id=? AND sequence>? ORDER BY sequence",
      )
      .all(runId, sequence) as EventRow[];

    return rows.map(mapEventRow);
  }

  writeArtifact(
    runId: string,
    nodeId: string,
    name: string,
    content: string,
  ): ArtifactRecord {
    const dir = join(this.root, runId, "artifacts", nodeId);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, name);
    const hash = createHash("sha256").update(content).digest("hex");
    writeFileSync(path, content);
    this.db
      .prepare("INSERT INTO artifacts VALUES(?,?,?,?,?,?,?)")
      .run(
        `artifact_${randomUUID()}`,
        runId,
        nodeId,
        name,
        path,
        hash,
        new Date().toISOString(),
      );
    return { path, hash };
  }

  listNodeComments(graphId: string, nodeId?: string): NodeCommentRecord[] {
    const rows = (
      nodeId
        ? (this.db
            .prepare(
              "SELECT id,graph_id,node_id,role,body,created_at FROM node_comments WHERE graph_id=? AND node_id=? ORDER BY created_at ASC",
            )
            .all(graphId, nodeId) as Array<{
            id: string;
            graph_id: string;
            node_id: string;
            role: "user" | "system";
            body: string;
            created_at: string;
          }>)
        : (this.db
            .prepare(
              "SELECT id,graph_id,node_id,role,body,created_at FROM node_comments WHERE graph_id=? ORDER BY created_at ASC",
            )
            .all(graphId) as Array<{
            id: string;
            graph_id: string;
            node_id: string;
            role: "user" | "system";
            body: string;
            created_at: string;
          }>)
    ).map(function mapComment(row) {
      return {
        id: row.id,
        graphId: row.graph_id,
        nodeId: row.node_id,
        role: row.role,
        body: row.body,
        createdAt: row.created_at,
      };
    });
    return rows;
  }

  addNodeComment(
    graphId: string,
    nodeId: string,
    body: string,
    role: "user" | "system" = "user",
  ): NodeCommentRecord {
    const comment: NodeCommentRecord = {
      id: `comment_${randomUUID()}`,
      graphId,
      nodeId,
      role,
      body,
      createdAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        "INSERT INTO node_comments(id,graph_id,node_id,role,body,created_at) VALUES(?,?,?,?,?,?)",
      )
      .run(
        comment.id,
        comment.graphId,
        comment.nodeId,
        comment.role,
        comment.body,
        comment.createdAt,
      );
    return comment;
  }
}
