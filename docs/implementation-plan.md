# OpenGraph v0.1 Implementation Plan

## Phase 0 — executable local loop

- Establish the strict pnpm TypeScript workspace and shared contracts.
- Implement SQLite WAL migrations and immutable graph versions.
- Implement deterministic GraphSpec linting and the sample draft.
- Expose review/approval APIs and a recognizable node-canvas dashboard.
- Run the sample graph through the same normalized event path with Mock ACP.

Exit gate: an unapproved draft cannot run; approval starts a streamed, persisted run.

## Phase 1 — runtime correctness

- Compile approved specs into LangGraphJS `StateGraph` definitions.
- Schedule independent nodes concurrently within `maxParallel`.
- Add timeout, cancellation, bounded retry, fresh verification, and `give_up`.
- Add checkpoints and daemon restart recovery without replaying completed nodes.

Exit gate: runtime, retry, cancel, approval interrupt, fresh-session, and restart tests pass.

## Phase 2 — repository isolation

- Add dirty-base detection, per-writer Git worktrees and branches.
- Collect diffs and patches, verify write globs, integrate successful branches, surface conflicts.

Exit gate: isolation and out-of-scope mutation tests pass.

## Phase 3 — product surfaces

- Complete `graphctl` commands, planner-safe MCP server, and Codex/Claude skills.
- Complete Review/Run inspectors, event replay, controls, and evidence panels.
- Add repository and agent discovery.

Exit gate: `graphctl doctor`, `graphctl demo`, dashboard, and MCP contract tests pass.

## Phase 4 — acceptance

- Add migration, end-to-end browser, and daemon restart scenarios.
- Finish operational, GraphSpec, adapter, security, and roadmap docs.
- Run install, typecheck, lint, unit/integration tests, e2e, doctor, and demo gates.

The goal is complete only when every acceptance gate above is demonstrated from the current checkout.
