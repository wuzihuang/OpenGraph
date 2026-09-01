# GraphSpec v1

`GraphSpecV1` is the single source of truth shared by the planner, dashboard, database, compiler, and runtime. It is a Zod contract exported from `packages/contracts`.

The root declares `version`, `executionMode`, `goal`, `acceptanceCriteria`, `repository`, `policies`, `nodes`, and artifact-bearing `edges`. Policies bound parallel width, graph depth, node attempts, total runtime, network access, nested subagents, and the human approval boundary.

Each node has one objective; a capability-based agent selector; read-only, worktree, or integration workspace; explicit read/write globs; named input and output contracts; physical acceptance checks; bounded retry and timeout; fresh verifier rules; and an approval policy. Every edge carries one or more declared output artifacts. Completion-only edges are invalid.

The deterministic linter emits stable codes for duplicate or orphan nodes, unknown edge endpoints, missing producers, unused outputs, fake edges, unbounded cycles, broad responsibility, parallel write conflicts, missing checks or verifiers, width overflow, invalid approval boundaries, and invalid retries. A graph is compiled only after the same linter reports no errors. Any edit creates and validates a new immutable version.

The compiled run state contains exactly eight top-level fields: `runId`, `graphVersion`, `repoRef`, `nodeIndex`, `artifactIndex`, `budgetState`, `decisionFlags`, and `finalStatus`. Transcripts, diffs, logs, test reports, and source content remain in the artifact store.

