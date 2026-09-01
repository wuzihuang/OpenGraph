import { z } from "zod";

export const RunEventType = z.enum([
  "graph.status",
  "node.status",
  "node.ready",
  "agent.message.delta",
  "agent.plan.snapshot",
  "agent.tool.started",
  "agent.tool.updated",
  "agent.terminal.delta",
  "agent.permission.requested",
  "agent.diff",
  "node.check.started",
  "node.check.completed",
  "node.check.failed",
  "node.supervision.rejected",
  "node.verification.failed",
  "node.retry.scheduled",
  "artifact.created",
  "approval.requested",
  "run.completed",
  "run.failed",
]);

export const NormalizedRunEvent = z.object({
  eventId: z.string(),
  sequence: z.number().int().positive(),
  timestamp: z.string(),
  projectId: z.string(),
  graphId: z.string(),
  runId: z.string(),
  nodeId: z.string().nullable(),
  attempt: z.number().int().min(0),
  agentId: z.string().nullable(),
  agentSessionId: z.string().nullable(),
  type: RunEventType,
  payload: z.record(z.string(), z.unknown()),
});

export type NormalizedRunEvent = z.infer<typeof NormalizedRunEvent>;
export type RunEventType = z.infer<typeof RunEventType>;
