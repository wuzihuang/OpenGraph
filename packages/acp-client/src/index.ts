import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import type { RunEventType } from "../../contracts/src/index.ts";

export { PROTOCOL_VERSION };

export type AcpUpdate = {
  kind:
    | "message"
    | "plan"
    | "tool_started"
    | "tool_updated"
    | "terminal"
    | "permission"
    | "diff";
  payload: Record<string, unknown>;
};

export type NormalizedAcpUpdate = {
  type: RunEventType;
  payload: Record<string, unknown>;
};

const EVENT_TYPE_BY_UPDATE_KIND: Record<AcpUpdate["kind"], RunEventType> = {
  message: "agent.message.delta",
  plan: "agent.plan.snapshot",
  tool_started: "agent.tool.started",
  tool_updated: "agent.tool.updated",
  terminal: "agent.terminal.delta",
  permission: "agent.permission.requested",
  diff: "agent.diff",
};

export const SAFE_ENV_KEYS = [
  "PATH",
  "LANG",
  "LC_ALL",
  "TERM",
  "TMPDIR",
  "SHELL",
] as const;

export function normalizeAcpUpdate(update: AcpUpdate): NormalizedAcpUpdate {
  return {
    type: EVENT_TYPE_BY_UPDATE_KIND[update.kind],
    payload: update.payload,
  };
}

export function safeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const safeEntries: Array<[string, string]> = [];

  for (const key of SAFE_ENV_KEYS) {
    const value = env[key];
    if (value !== undefined) {
      safeEntries.push([key, value]);
    }
  }

  return Object.fromEntries(safeEntries);
}

export function redactSecrets(value: string): string {
  return value
    .replace(
      /(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    )
    .replace(/(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{16,}/g, "[REDACTED]");
}
