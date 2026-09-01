# Graph

Graph turns a repository goal into a validated execution-graph Draft and opens a local Dashboard for review.

After installing with `./install-graph` (or a host marketplace), start a new agent session and invoke it with a goal:

```text
Codex:        $graph <goal>
Claude Code:  /graph <goal>   or   /graph:graph <goal>
Cursor:       /graph <goal>
Qoder/ZCode:  /graph <goal>
Kimi:         /skill:graph <goal>
Hermes / OpenClaw / Gemini / Qwen: use the graph skill with your goal
```

`./install-graph all` wires the Graph workflow skill, the graph-design doctrine skill, and the MCP launcher into every known planner host. Hosts that already load `~/.agents/skills` can use `./install-graph agents` plus their own MCP config pointing at `scripts/launch-graph`.

The first invocation installs the plugin's local SQLite runtime dependency. Graph binds Dashboard to `127.0.0.1`, stores state under `~/.graph`, and preserves the human approval boundary.
