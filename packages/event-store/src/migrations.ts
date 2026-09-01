import type Database from "better-sqlite3";
import type { Migration, MigrationVersionRow } from "./types.ts";

const migrations: readonly Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,root TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS agent_installations(id TEXT PRIMARY KEY,data TEXT NOT NULL,probed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS graph_specs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS graph_versions(id TEXT PRIMARY KEY,graph_id TEXT NOT NULL,version INTEGER NOT NULL,spec TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(graph_id,version));
CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,graph_id TEXT NOT NULL,graph_version_id TEXT NOT NULL,status TEXT NOT NULL,state TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS node_runs(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,node_id TEXT NOT NULL,attempt INTEGER NOT NULL,status TEXT NOT NULL,session_id TEXT,updated_at TEXT NOT NULL,UNIQUE(run_id,node_id,attempt));
CREATE TABLE IF NOT EXISTS agent_sessions(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,node_id TEXT NOT NULL,attempt INTEGER NOT NULL,role TEXT NOT NULL,status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events(event_id TEXT PRIMARY KEY,sequence INTEGER NOT NULL,timestamp TEXT NOT NULL,project_id TEXT NOT NULL,graph_id TEXT NOT NULL,run_id TEXT NOT NULL,node_id TEXT,attempt INTEGER NOT NULL,agent_id TEXT,agent_session_id TEXT,type TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(run_id,sequence));
CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,node_id TEXT NOT NULL,name TEXT NOT NULL,path TEXT NOT NULL,hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY,graph_version_id TEXT NOT NULL,run_id TEXT,decision TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);`,
  },
  {
    version: 2,
    sql: "ALTER TABLE runs ADD COLUMN resumed_count INTEGER NOT NULL DEFAULT 0;",
  },
];

export function applyMigrations(db: Database.Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
  );

  const appliedVersions = new Set(
    (
      db
        .prepare("SELECT version FROM migrations")
        .all() as MigrationVersionRow[]
    ).map((row) => row.version),
  );

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    const migrate = db.transaction(() => {
      try {
        db.exec(migration.sql);
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes("duplicate column")
        ) {
          throw error;
        }
      }

      db.prepare("INSERT INTO migrations(version,applied_at) VALUES(?,?)").run(
        migration.version,
        new Date().toISOString(),
      );
    });

    migrate();
  }
}
