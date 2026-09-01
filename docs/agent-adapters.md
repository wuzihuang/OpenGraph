# Agent adapters

`graphctl doctor` probes candidates using executable paths and argument arrays. It records path, version, adapter command, transport, authentication status, capabilities, probe time, health, and errors; it never reads or persists login tokens.

| Agent | Probe | Default ACP command | v0.1 status |
| --- | --- | --- | --- |
| Claude Agent | `claude --version` | `claude-agent-acp` | discoverable adapter |
| Codex | `codex --version` | `codex-acp` | discoverable adapter |
| Kimi | `kimi --version` | `kimi acp` | discoverable adapter |
| Qoder | `qoder --version` | `qoder acp` | discoverable adapter |
| Cursor | `agent --version` | `agent acp` | discoverable adapter |
| ZCode | none | none | invocation surface only |
| Mock ACP | local process | built in | fully executable and tested |

The Mock ACP Agent supports initialize, new/prompt/cancel session flow, resumable session identity, plan and message streaming, tool and terminal updates, permission and diff event shapes, controlled delay/cancel, and retry verification. Its events pass through the same normalizer used by real adapters.

Real adapters must pass an ACP contract suite before being marked executable. A worker and its verifier always use different session IDs; verifier sessions are read-only and do not receive worker transcripts.

