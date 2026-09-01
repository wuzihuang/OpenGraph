import { z } from "zod";
import { AcceptanceCheck, ArtifactContract } from "./artifacts.ts";

export const GraphNodeV1 = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/),
  title: z.string().min(1),
  kind: z.enum([
    "analysis",
    "worker",
    "reducer",
    "integration",
    "verifier",
    "acceptance",
    "human",
  ]),
  objective: z.string().min(8),
  agentSelector: z.object({
    requiredCapabilities: z.array(z.string()).default([]),
    preferredAgents: z.array(z.string()).default([]),
  }),
  workspace: z.object({
    mode: z.enum(["readonly", "worktree", "integration"]),
    readGlobs: z.array(z.string()),
    writeGlobs: z.array(z.string()),
  }),
  inputs: z.array(z.string()),
  outputs: z.array(ArtifactContract),
  acceptanceChecks: z.array(AcceptanceCheck),
  retryPolicy: z.object({
    maxAttempts: z.number().int().min(1).max(10),
    freshSession: z.boolean(),
    backoffMs: z.number().int().min(0).max(60_000).default(0),
  }),
  timeoutSeconds: z.number().int().min(1).max(86_400),
  verifierPolicy: z.object({
    required: z.boolean(),
    freshSession: z.boolean(),
    readonly: z.boolean(),
  }),
  approvalPolicy: z.enum(["none", "on_permission", "always"]),
  irreversible: z.boolean().default(false),
});

export const GraphEdgeV1 = z.object({
  from: z.string(),
  to: z.string(),
  artifacts: z.array(z.string()),
  condition: z.string().optional(),
});

export const GraphSpecV1 = z.object({
  version: z.literal("1.0"),
  executionMode: z.enum(["single_agent", "graph"]),
  goal: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  repository: z.object({
    root: z.string().min(1),
    baseRef: z.string().min(1),
  }),
  policies: z.object({
    maxParallel: z.number().int().min(1).max(32),
    maxGraphDepth: z.number().int().min(1).max(64),
    maxNodeAttempts: z.number().int().min(1).max(10),
    maxRuntimeSeconds: z.number().int().min(1),
    networkPolicy: z.enum(["denied", "approval_required", "allowed"]),
    nestedSubagents: z.boolean(),
    approvalPolicy: z.literal("human_required"),
    /**
     * Acceptance criteria and checks are frozen for workers (Goodhart / measurement decay).
     * Changing them requires `graph_propose_amendment` and a new human-approved version.
     * Default true so planner drafts and older stored graphs remain runnable.
     */
    acceptanceFrozen: z.literal(true).default(true),
  }),
  nodes: z.array(GraphNodeV1).min(1),
  edges: z.array(GraphEdgeV1),
});

export type GraphSpec = z.infer<typeof GraphSpecV1>;
export type GraphNode = z.infer<typeof GraphNodeV1>;
export type GraphEdge = z.infer<typeof GraphEdgeV1>;
