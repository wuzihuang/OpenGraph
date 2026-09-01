# GraphSpec v1

`GraphSpecV1` is the single source of truth shared by the planner, dashboard, database, compiler, and runtime. It is a Zod contract exported from `packages/contracts`.

The root declares `version`, `executionMode`, `goal`, `goalCharter`, `acceptanceCriteria`, `repository`, `policies`, `nodes`, and artifact-bearing `edges`. `goalCharter` holds three human-confirmed layers — `strategic`, `medium`, and `fast` — that mutually constrain each other. Policies bound parallel width, graph depth, node attempts, total runtime, network access, nested subagents, the human approval boundary, and `acceptanceFrozen: true` so workers cannot thaw pass criteria in place.

Each node has one objective; a capability-based agent selector (`requiredCapabilities` should use stable tags from `graph_discover_environment`, not raw MCP tool schemas); read-only, worktree, or integration workspace; explicit read/write globs; named input and output contracts; physical acceptance checks (default `frozen: true`); bounded retry and timeout; fresh verifier rules; and an approval policy. Every edge carries one or more declared output artifacts. Completion-only edges are invalid.

Node kinds map to supervision roles for review: `analysis` / `worker` / `reducer` / `integration` → execute; `verifier` → supervise; `acceptance` → accept; `human` → anchor. OpenGraph treats Graph Engineering as loops watching loops: the planner confirms a Goal Charter (Strategic / Medium / Fast goals that constrain each other), then drafts three loop bodies — each with workers plus an adversarial verifier path. Writers must reach an independent verifier node (`MISSING_SUPERVISOR_PATH`), not only self-score via `verifierPolicy`. Medium evidence must differ from the Fast KPI so one loop can veto another.

The deterministic linter emits stable codes for duplicate or orphan nodes, unknown edge endpoints, missing producers, unused outputs, fake edges, unbounded cycles, broad responsibility, parallel write conflicts, missing checks or verifiers, missing supervisor paths, missing goal charter layers, missing fast/medium/strategic loop bodies, thawed acceptance, width overflow, invalid approval boundaries, and invalid retries. A graph is compiled only after the same linter reports no errors. Before a draft is published, a mock shadow-run must walk the compiled LangGraph to completion; `SHADOW_FAILED` blocks publish. Any edit creates and validates a new immutable version (amend also re-runs shadow certification).

Runtime distinguishes physical `node.check.failed` from qualitative `node.supervision.rejected` (and still emits `node.verification.failed` with `rejectionKind` for compatibility).

The compiled run state contains exactly eight top-level fields: `runId`, `graphVersion`, `repoRef`, `nodeIndex`, `artifactIndex`, `budgetState`, `decisionFlags`, and `finalStatus`. Transcripts, diffs, logs, test reports, and source content remain in the artifact store.

