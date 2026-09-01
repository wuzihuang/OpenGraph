# OpenGraph Architecture

OpenGraph is a local-first Graph Engineering compiler and runtime. A host model may create only declarative `GraphSpecV1` JSON. Deterministic code validates, versions, compiles, approves, executes, persists, and observes that specification.

## Trust boundaries

1. **Planner surface** — Any supported host (Codex, Claude Code, Cursor, Qoder, ZCode, OpenClaw, Hermes, Kimi, Gemini, Qwen, or shared Agent Skills) loads the Graph skill and calls MCP discovery, inspection, validation, draft publication, status, amendment, and `graph_start_run` tools. Planning cannot start a run; a later explicit Execute request in agent chat authorizes `graph_start_run`.
2. **Graph compiler** — Zod parsing and deterministic lint rules form the only path from a draft into an executable graph.
3. **Human approval** — an explicit Execute request in agent chat authorizes `graph_start_run`, which records version-specific approval and starts atomically. CLI users may use `graphctl graph approve`; the Dashboard is display-only.
4. **Runtime** — `graphd` schedules ready nodes with a global width budget, persists every transition, uses isolated worktrees for writers, and resumes incomplete runs after restart.
5. **Agent boundary** — ACP sessions are per node attempt. Verification always uses a new, read-only session and sees only the objective, diff, artifacts, and physical check evidence.

## Components

- `apps/daemon`: thin executable entry point for the local daemon.
- `apps/web`: React/Vite dashboard with review and run modes.
- `apps/cli`: `graphctl` command surface.
- `packages/daemon-core`: Fastify HTTP/WebSocket routes, authentication, dashboard hosting, and lifecycle recovery.
- `packages/api-client`: shared authenticated JSON client used by CLI and MCP surfaces.
- `packages/contracts`: GraphSpec, event, task, result, and verification contracts.
- `packages/graph-compiler`: deterministic linter and LangGraphJS compiler adapter.
- `packages/graph-runtime`: approval interrupt, ready-node scheduler, retries, cancellation, checkpoints, recovery.
- `packages/acp-client`: ACP process lifecycle and event normalization.
- `packages/agent-registry`: safe PATH/version discovery, MCP server-name inventory (no secrets), and planner capability summaries.
- `packages/repo-intelligence`: repository metadata and command discovery.
- `packages/worktree-manager`: branch/worktree isolation, diff and write-scope verification, integration.
- `packages/event-store`: SQLite WAL schema, migrations, monotonic run events, artifact metadata.
- `packages/mock-acp-agent`: local ACP-compatible process used by the complete demo.
- `packages/claude-code-agent`: Claude Code worker adapter used when the executable is available.
- `packages/plugin-mcp`: planner-safe MCP tools.

Package entry points are stable barrels. Contracts, compiler rules, persistence queries, scheduling,
node execution, and transport routes live in focused modules behind those entry points. Generated
plugin files under `plugins/graph/runtime` are produced only by `pnpm plugin:build`; see the
[development guide](development.md) for source and verification boundaries.

## Persistent model

SQLite WAL stores projects, agent installations, graph specs and immutable versions, runs, node runs, sessions, events, artifacts, approvals, and migrations. Large payloads live below `.graph-engineer/runs/<run-id>/`; runtime state stores only references and hashes.

The runtime state has exactly eight top-level fields: `runId`, `graphVersion`, `repoRef`, `nodeIndex`, `artifactIndex`, `budgetState`, `decisionFlags`, and `finalStatus`.

## Execution sequence

Draft → deterministic validation → **mock shadow-run (prior walk)** → immutable version → human approval → compile → ready-node scheduling → ACP worker → physical checks → fresh verifier → bounded retry or artifact publication → integration → acceptance → report.

Publish is blocked unless the shadow-run completes: an ephemeral git clone + Mock ACP walks every node so the LangGraph is runtime-certified before the human sees a Draft. Shadow softens business acceptance commands after probing binaries; it never approves the user's draft or starts the real-agent run.

Every normalized event is committed before WebSocket broadcast. Reconnecting clients request events after their last sequence. A run-local transaction assigns strictly increasing sequence numbers.

## Safety model

The daemon binds to `127.0.0.1`, requires a random local session token, passes an allowlisted environment to child processes, redacts common secret shapes, never persists agent credentials, uses argument arrays, and cancels ACP before terminating the whole process group. Network, package installation, publishing, pushing, deletion, payment, and other irreversible operations require explicit approval.

Graph Engineering is **loops watching loops**: the planner first confirms a **Goal Charter** (Strategic / Medium / Fast goals that constrain each other), then drafts **three loop bodies**, each with workers plus adversarial review. It is not a prettier workflow DAG. Single-loop automation fails via Goodhart, upward blindness, conflict, and measurement decay.

Controls map to three Perez anchors:

1. **Anchors** — physical acceptance commands, write-glob checks, artifact hashes, and diffs are external facts workers cannot invent.
2. **Frozen nodes** — `acceptanceFrozen` plus immutable graph versions keep evaluation criteria out of the optimizer's hands.
3. **External judgment** — humans lock the Goal Charter and explicitly request Execute; only then may the host call `graph_start_run`. The Dashboard never grants approval.

Full planner prompt doctrine lives in `plugins/graph/skills/graph/SKILL.md`.
