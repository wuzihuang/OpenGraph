# Graph

Graph turns a repository goal into a validated execution-graph Draft and opens a local Dashboard for review.

After installing the plugin, start a new agent session and invoke it with a goal:

```text
Codex:       $graph <goal>
Claude Code: /graph:graph <goal>
```

The repository-level `install-graph` script also installs a Claude Code alias so `/graph <goal>` works directly.

The first invocation installs the plugin's local SQLite runtime dependency. Graph binds Dashboard to `127.0.0.1`, stores state under `~/.graph`, and preserves the human approval boundary.
