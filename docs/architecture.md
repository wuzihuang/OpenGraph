# Graph Engineer Architecture

Graph Engineer is a local-first Graph Engineering compiler and runtime. A host model may create only declarative `GraphSpecV1` JSON. Deterministic code validates, versions, compiles, approves, executes, persists, and observes that specification.

## Trust boundaries

1. **Planner surface** — Codex/Claude skills call MCP discovery, inspection, validation, draft publication, status, and amendment tools. No planner-facing tool can approve or execute a graph.
2. **Graph compiler** — Zod parsing and deterministic lint rules form the only path from a draft into an executable graph.
3. **Human approval** — a version-specific approval from the dashboard or `graphctl graph approve` is required before a run can leave `awaiting_approval`.
4. **Runtime** — `graphd` schedules ready nodes with a global width budget, persists every transition, uses isolated worktrees for writers, and resumes incomplete runs after restart.
5. **Agent boundary** — ACP sessions are per node attempt. Verification always uses a new, read-only session and sees only the objective, diff, artifacts, and physical check evidence.

## Components

- `apps/daemon`: Fastify HTTP/WebSocket API, session-token middleware, lifecycle recovery.
- `apps/web`: React/Vite dashboard with review and run modes.
- `apps/cli`: `graphctl` command surface.
- `packages/contracts`: GraphSpec, event, task, result, and verification contracts.
- `packages/graph-compiler`: deterministic linter and LangGraphJS compiler adapter.
- `packages/graph-runtime`: approval interrupt, ready-node scheduler, retries, cancellation, checkpoints, recovery.
- `packages/acp-client`: ACP process lifecycle and event normalization.
- `packages/agent-registry`: safe PATH/version discovery and adapter inventory.
- `packages/repo-intelligence`: repository metadata and command discovery.
- `packages/worktree-manager`: branch/worktree isolation, diff and write-scope verification, integration.
- `packages/event-store`: SQLite WAL schema, migrations, monotonic run events, artifact metadata.
- `packages/mock-acp-agent`: local ACP-compatible process used by the complete demo.
- `packages/plugin-mcp`: planner-safe MCP tools.

## Persistent model

SQLite WAL stores projects, agent installations, graph specs and immutable versions, runs, node runs, sessions, events, artifacts, approvals, and migrations. Large payloads live below `.graph-engineer/runs/<run-id>/`; runtime state stores only references and hashes.

The runtime state has exactly eight top-level fields: `runId`, `graphVersion`, `repoRef`, `nodeIndex`, `artifactIndex`, `budgetState`, `decisionFlags`, and `finalStatus`.

## Execution sequence

Draft → deterministic validation → immutable version → human approval → compile → ready-node scheduling → ACP worker → physical checks → fresh verifier → bounded retry or artifact publication → integration → acceptance → report.

Every normalized event is committed before WebSocket broadcast. Reconnecting clients request events after their last sequence. A run-local transaction assigns strictly increasing sequence numbers.

## Safety model

The daemon binds to `127.0.0.1`, requires a random local session token, passes an allowlisted environment to child processes, redacts common secret shapes, never persists agent credentials, uses argument arrays, and cancels ACP before terminating the whole process group. Network, package installation, publishing, pushing, deletion, payment, and other irreversible operations require explicit approval.

