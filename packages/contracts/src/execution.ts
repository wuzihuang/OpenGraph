import { z } from "zod";
import { ArtifactContract } from "./artifacts.ts";

export const TaskEnvelope = z.object({
  runId: z.string(),
  nodeId: z.string(),
  attempt: z.number().int().positive(),
  objective: z.string(),
  workspace: z.string(),
  readGlobs: z.array(z.string()),
  writeGlobs: z.array(z.string()),
  inputArtifactPaths: z.array(z.string()),
  outputContract: z.array(ArtifactContract),
  acceptanceCommands: z.array(z.string()),
  timeoutSeconds: z.number().positive(),
  prohibitedOperations: z.array(z.string()),
});

export const NodeResult = z.object({
  status: z.enum(["completed", "failed", "cancelled"]),
  summary: z.string(),
  changedFiles: z.array(z.string()),
  artifacts: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
    }),
  ),
  evidence: z.array(
    z.object({
      type: z.string(),
      command: z.string().optional(),
      exitCode: z.number().optional(),
    }),
  ),
});

export const VerificationRejectionKind = z.enum([
  "check_failed",
  "supervision_rejected",
]);

export const VerificationResult = z.object({
  accepted: z.boolean(),
  sessionId: z.string(),
  reasons: z.array(z.string()),
  checkedArtifacts: z.array(z.string()),
  rejectionKind: VerificationRejectionKind.optional(),
});

export type TaskEnvelope = z.infer<typeof TaskEnvelope>;
export type NodeResult = z.infer<typeof NodeResult>;
export type VerificationResult = z.infer<typeof VerificationResult>;

export type RunState = {
  runId: string;
  graphVersion: string;
  repoRef: string;
  nodeIndex: Record<string, string>;
  artifactIndex: Record<string, { path: string; hash: string }>;
  budgetState: { startedAt: string; attempts: number };
  decisionFlags: Record<string, boolean | string>;
  finalStatus: string;
};
