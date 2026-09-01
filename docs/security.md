# Security and threat model

OpenGraph treats the repository, planner output, agent output, and event payloads as untrusted input.

- `graphd` listens on `127.0.0.1` and API/WebSocket access requires a random, mode-0600 local session token.
- Planner MCP tools can discover, inspect, validate, publish drafts, read status, and propose amendments. No planner tool can approve or run a graph.
- Approval is bound to an immutable graph version and is written to the audit store.
- Child processes receive arguments as arrays and only an allowlisted environment. Common secret shapes are redacted, and agent tokens are never read or stored.
- Network and package operations default to approval-required. Push, deploy, publish, delete, payment, and other irreversible operations require explicit approval.
- Parallel writers receive separate Git worktrees. Modified paths are checked against `writeGlobs`; violations fail verification.
- Cancellation sends the protocol cancel first; process-backed adapters terminate the entire detached process group after a grace period.
- Agent-to-agent communication is limited to named artifacts, JSON contracts, diffs, and physical test evidence.
- Nested worker subagents are disabled by default and remain subject to the global width budget if enabled in a future version.
- Repository instructions cannot override compiler invariants, permission policy, or system safety rules.

The dashboard shows explicit plans, activity summaries, messages, tools, terminals, diffs, tests, and artifacts. It neither requests nor exposes hidden chain-of-thought.
