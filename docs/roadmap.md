# Roadmap and v0.1 limits

v0.1 proves the complete local vertical slice with Mock ACP, installs Graph as a planner surface across Codex, Claude Code, Cursor, Qoder, ZCode, OpenClaw, Hermes, Kimi, Gemini CLI, Qwen Code, and shared Agent Skills, and discovers documented real-agent ACP candidates. Real Claude, Codex, Kimi, Qoder, and Cursor **worker** execution remains gated on adapter-specific contract tests and local installation/authentication.

Not included in v0.1:

- cloud or multi-user control planes;
- PostgreSQL, Redis, object storage, Kubernetes, or microservices;
- vector databases, OpenViking, GBrain, or long-term semantic memory;
- ZCode/OpenClaw/Hermes ACP worker adapters beyond planner skill + MCP install;
- automatic network, package installation, publishing, deployment, pushing, deletion, or payment permission;
- cost billing and token accounting beyond event-ready fields;
- a production integration-agent conflict resolver (deterministic cherry-pick conflict detection exists first).

Next, add real adapter contract suites in the order Codex, Claude Agent, Kimi, Qoder, and Cursor; then add baseline-vs-graph experiments for acceptance pass rate, critical path, retry rate, verifier kill rate, fan-out efficiency, merge conflict rate, human intervention, and budget use.

Deferred beyond near-term work: multi-cadence “organizational” graphs (daily audit loops, weekly goal recalibration) that stay alive across many goals. v0.1 focuses on supervised single-goal execution graphs with frozen acceptance and human anchors.
