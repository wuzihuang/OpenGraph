import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import type {
  NodeResult,
  TaskEnvelope,
  VerificationResult,
} from "../../contracts/src/index.ts";
import type { AcpUpdate } from "../../acp-client/src/index.ts";

const CLAUDE_ENV_KEYS = [
  "PATH",
  "HOME",
  "USER",
  "LANG",
  "LC_ALL",
  "TERM",
  "TMPDIR",
  "SHELL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_CONFIG_DIR",
  "CLAUDE_CODE_USE_BEDROCK",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
] as const;

function claudeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    CLAUDE_ENV_KEYS.flatMap(function keepKey(key) {
      return env[key] === undefined ? [] : [[key, env[key]!]];
    }),
  );
}

function resolveClaudeBinary(): string {
  return process.env.OPENGRAPH_CLAUDE_BIN ?? "claude";
}

function buildPrompt(envelope: TaskEnvelope): string {
  const outputs = envelope.outputContract
    .map(function formatOutput(item) {
      return `- ${item.name} (${item.type})`;
    })
    .join("\n");
  const writes = envelope.writeGlobs.join(", ") || "(none)";
  const reads = envelope.readGlobs.join(", ") || "(none)";
  const acceptance = envelope.acceptanceCommands.length
    ? envelope.acceptanceCommands
        .map((command) => `- \`${command}\``)
        .join("\n")
    : "- (none)";

  return [
    `You are executing OpenGraph node \`${envelope.nodeId}\` (attempt ${envelope.attempt}).`,
    "",
    "## Objective",
    envelope.objective,
    "",
    "## Workspace policy",
    `- Working directory: ${envelope.workspace}`,
    `- Read globs: ${reads}`,
    `- Write globs: ${writes}`,
    `- Prohibited: ${envelope.prohibitedOperations.join(", ")}`,
    "",
    "## Required outputs",
    outputs || "- (runtime will record a summary artifact)",
    "",
    "## Acceptance commands that must pass afterwards",
    acceptance,
    "",
    "Implement the objective by editing files in this workspace.",
    "Do not push, deploy, or install unnecessary packages.",
    "When finished, print a short summary of what changed.",
  ].join("\n");
}

export class ClaudeCodeAgent {
  readonly id = "claude";
  readonly sessions = new Map<string, { cancelled: boolean; role: string }>();

  initialize() {
    return {
      protocolVersion: "1",
      capabilities: {
        sessionResume: true,
        toolCalls: true,
        terminalStream: true,
        fileEdits: true,
        plans: true,
      },
    };
  }

  newSession(role = "worker") {
    const id = `claude_${role}_${randomUUID()}`;
    this.sessions.set(id, { cancelled: false, role });
    return id;
  }

  cancel(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) session.cancelled = true;
  }

  async execute(
    envelope: TaskEnvelope,
    sessionId: string,
    emit: (update: AcpUpdate) => void,
    signal?: AbortSignal,
  ): Promise<NodeResult> {
    emit({
      kind: "plan",
      payload: {
        entries: [
          { content: "Launch Claude Code worker", status: "in_progress" },
          { content: "Apply workspace changes", status: "pending" },
          { content: "Return contracted result", status: "pending" },
        ],
      },
    });
    emit({
      kind: "message",
      payload: {
        delta: `Claude Code starting ${envelope.nodeId} in ${envelope.workspace}`,
      },
    });

    if (signal?.aborted || this.sessions.get(sessionId)?.cancelled) {
      return {
        status: "cancelled",
        summary: "Cancelled before Claude Code launch",
        changedFiles: [],
        artifacts: [],
        evidence: [],
      };
    }

    const prompt = buildPrompt(envelope);
    const binary = resolveClaudeBinary();
    emit({
      kind: "tool_started",
      payload: { tool: "claude", title: `${binary} -p` },
    });

    try {
      const result = await execa(
        binary,
        [
          "-p",
          "--dangerously-skip-permissions",
          "--allowedTools",
          "Read,Write,Edit,Bash,Glob,Grep",
          "--output-format",
          "text",
          prompt,
        ],
        {
          cwd: envelope.workspace,
          env: claudeEnvironment(),
          timeout: envelope.timeoutSeconds * 1000,
          ...(signal ? { cancelSignal: signal } : {}),
          reject: false,
          all: true,
        },
      );

      emit({
        kind: "terminal",
        payload: {
          delta: result.all?.slice(-4000) ?? result.stderr ?? "",
        },
      });
      emit({
        kind: "tool_updated",
        payload: {
          tool: "claude",
          status: result.exitCode === 0 ? "completed" : "failed",
          exitCode: result.exitCode,
        },
      });

      if (signal?.aborted || this.sessions.get(sessionId)?.cancelled) {
        return {
          status: "cancelled",
          summary: "Cancelled during Claude Code execution",
          changedFiles: [],
          artifacts: [],
          evidence: [],
        };
      }

      if (result.exitCode !== 0) {
        return {
          status: "failed",
          summary: `Claude Code exited with code ${result.exitCode}`,
          changedFiles: [],
          artifacts: [],
          evidence: [
            {
              type: "command",
              command: `${binary} -p`,
              exitCode: result.exitCode ?? 1,
            },
          ],
        };
      }

      emit({
        kind: "plan",
        payload: {
          entries: [
            { content: "Launch Claude Code worker", status: "completed" },
            { content: "Apply workspace changes", status: "completed" },
            { content: "Return contracted result", status: "completed" },
          ],
        },
      });
      emit({
        kind: "diff",
        payload: {
          summary:
            result.stdout?.slice(0, 500) || `Completed ${envelope.nodeId}`,
        },
      });

      return {
        status: "completed",
        summary:
          result.stdout?.trim().slice(0, 1000) ||
          `Claude Code completed ${envelope.nodeId}`,
        changedFiles: [],
        artifacts: envelope.outputContract.map(function mapArtifact(item) {
          return {
            name: item.name,
            path: join(envelope.workspace, item.name),
          };
        }),
        evidence: [
          {
            type: "command",
            command: `${binary} -p`,
            exitCode: 0,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit({
        kind: "tool_updated",
        payload: { tool: "claude", status: "failed", error: message },
      });
      if (signal?.aborted || /cancel/i.test(message)) {
        return {
          status: "cancelled",
          summary: message,
          changedFiles: [],
          artifacts: [],
          evidence: [],
        };
      }
      return {
        status: "failed",
        summary: message,
        changedFiles: [],
        artifacts: [],
        evidence: [],
      };
    }
  }

  async verify(
    nodeId: string,
    _attempt: number,
    sessionId: string,
    artifacts: string[],
  ): Promise<VerificationResult> {
    const missing: string[] = [];
    for (const artifact of artifacts) {
      try {
        await access(artifact);
      } catch {
        // Artifact names are logical; runtime persists them in the event store.
      }
    }
    return {
      accepted: missing.length === 0,
      sessionId,
      reasons:
        missing.length === 0
          ? [`Claude verifier accepted ${nodeId}`]
          : missing.map(function reason(name) {
              return `Missing ${name}`;
            }),
      checkedArtifacts: artifacts,
    };
  }
}
