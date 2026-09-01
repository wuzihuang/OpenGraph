# Agent adapters and planner hosts

OpenGraph has two agent surfaces:

1. **Planner hosts** — where a human invokes Graph (`$graph` / `/graph` / skill) so the host model builds a Draft through planner-safe MCP tools.
2. **Worker adapters** — ACP processes the runtime may launch for node execution after human approval.

## Planner hosts

`./install-graph [host|all]` installs the shared Graph skill (design + workflow) and host-specific MCP wiring. The skill and MCP server are the portable core; plugin marketplaces are used when a host provides one.

| Host | Install target | Skill / plugin path | MCP wiring | Invoke |
| --- | --- | --- | --- | --- |
| Codex | `codex` | Codex plugin marketplace + `~/.codex/skills/graph` | plugin `.mcp.json` | `$graph <goal>` |
| Claude Code | `claude` | Claude marketplace + `~/.claude/skills/graph` | plugin `.mcp.json` | `/graph <goal>` |
| Cursor | `cursor` | `~/.cursor/skills/graph`, `~/.agents/skills/graph` | `~/.cursor/mcp.json` | `/graph <goal>` |
| Qoder | `qoder` | `.qoder-plugin` marketplace / `~/.qoder/skills/graph` | plugin `.mcp.json` | `/graph <goal>` |
| ZCode | `zcode` | `.zcode-plugin` + `~/.zcode/skills/graph` | plugin `.mcp.json` | `/graph <goal>` |
| OpenClaw | `openclaw` | `~/.openclaw/skills/graph`, `~/.agents/skills/graph` | `~/.openclaw/openclaw.json` → `mcp.servers` | graph skill |
| Hermes Agent | `hermes` | `~/.hermes/skills/software-development/graph` | `~/.hermes/config.yaml` → `mcp_servers` | graph skill |
| Kimi Code | `kimi` | `~/.kimi/skills/graph`, `~/.agents/skills/graph` | `~/.kimi-code/mcp.json` | `/skill:graph <goal>` |
| Gemini CLI | `gemini` | `~/.gemini/skills/graph`, `~/.agents/skills/graph` | `~/.gemini/settings.json` | graph skill |
| Qwen Code | `qwen` | `~/.qwen/skills/graph`, `~/.agents/skills/graph` | `~/.qwen/settings.json` | graph skill |
| Shared Agent Skills | `agents` | `~/.agents/skills/graph` | host-specific | any skills-compatible agent |

`./install-graph all` installs every known host. Missing CLIs are skipped with a warning; skill and MCP files are still written where paths are stable.

Any Agent Skills–compatible host that already loads `~/.agents/skills` can use Graph after `./install-graph agents` once its MCP config points at `plugins/graph/scripts/launch-graph`.

## Worker adapters

`graphctl doctor` probes candidates using executable paths and argument arrays. It records path, version, adapter command, transport, authentication status, capabilities, MCP server **names**, skill **name+description**, probe time, health, and errors; it never reads or persists login tokens.

`graph_discover_environment` (and `GET /api/environment`) returns a planner-oriented inventory:

| Field | Meaning |
| --- | --- |
| `plannerBrief` | Condensed decision packet for the main planner (usable agents, MCP, skills, assignment hints) |
| `agents` | Per-agent probe result plus merged `capabilities` / `mcpServers` / `skills` |
| `availableCapabilities` | Union of stable tags across usable agents |
| `agentsByCapability` | Map from capability tag → agent ids |
| `plannerNotes` | Short guidance: prefer tags in `agentSelector`, not raw tool schemas |

Known MCP server names are mapped to domain tags when possible (`browser`, `github`, `sentry`, …) and always also expose `mcp:<server>`. Host skills expose `skill:<name>`.

| Agent | Probe | Default ACP command | v0.1 status |
| --- | --- | --- | --- |
| Claude Agent | `claude --version` | `claude-agent-acp` | discoverable adapter |
| Codex | `codex --version` | `codex-acp` | discoverable adapter |
| Kimi | `kimi --version` | `kimi acp` | discoverable adapter |
| Qoder | `qoder --version` | `qoder acp` | discoverable adapter |
| Cursor | `agent --version` | `agent acp` | discoverable adapter |
| Hermes | `hermes --version` | none | planner surface |
| OpenClaw | `openclaw --version` | none | planner surface |
| Gemini CLI | `gemini --version` | none | planner surface |
| ZCode | `zcode --version` | none | planner surface |
| Qwen Code | `qwen --version` | none | planner surface |
| Mock ACP | local process | built in | fully executable and tested |

The Mock ACP Agent supports initialize, new/prompt/cancel session flow, resumable session identity, plan and message streaming, tool and terminal updates, permission and diff event shapes, controlled delay/cancel, and retry verification. Its events pass through the same normalizer used by real adapters.

Real ACP worker adapters must pass an ACP contract suite before being marked executable. A worker and its verifier always use different session IDs; verifier sessions are read-only and do not receive worker transcripts.
