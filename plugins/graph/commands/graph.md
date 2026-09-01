---
description: Plan a repository goal as a validated Graph draft and open the local Dashboard
argument-hint: "<goal>"
---

Treat `$ARGUMENTS` as the goal. If no goal was supplied, ask for one concise goal and stop.

1. Call `graph_discover_environment`, then call `graph_inspect_repository` for the current repository root.
2. Read `plannerBrief` (MCP + skills decision packet), then `availableCapabilities` / `agentsByCapability` / `plannerNotes`. Infer a practical `GraphSpecV1` and assign agents per node. Apply the **graph-design** skill (decomposition, artifact edges, topology patterns, agent capability matching, and pre-validate rubric). Ask only when a missing choice would materially change the graph.
3. Make dependencies explicit with named artifacts. Isolate parallel writers, bound retries, require fresh read-only verification for code-writing nodes, and keep nested subagents disabled by default.
4. Design supervision, not only sequencing: every writing node must reach an independent `verifier` node; set `policies.acceptanceFrozen: true`; keep acceptance checks frozen for workers. Prefer execute / supervise / accept / human-anchor roles over a single self-scoring loop.
5. Call `graph_validate_spec`. Fix every validation error and validate again after each edit.
6. Call `graph_publish_draft` after validation succeeds.
7. Immediately call `graph_open_dashboard` with the published graph ID.
8. If the tool returns `dashboardUrl`, also open that URL with the host URL opener when available (in Cursor: `open_resource`). Never claim the Dashboard is open unless a tool reported success or the host opener confirmed it.
9. Tell the user the Draft is ready for review and include the `dashboardUrl` as a clickable link. Keep the response short.

Stop after opening the Draft. Never approve or start a graph on the user's behalf.
