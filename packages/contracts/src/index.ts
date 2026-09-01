import { z } from 'zod';

export const ArtifactContract = z.object({ name: z.string().min(1), type: z.enum(['json','text','git_patch','test_report','diff','directory']), schema: z.record(z.string(), z.unknown()).optional() });
export const AcceptanceCheck = z.object({ type: z.enum(['command','artifact','schema','human']), command: z.string().optional(), description: z.string().min(1) });
export const GraphNodeV1 = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/), title: z.string().min(1), kind: z.enum(['analysis','worker','reducer','integration','verifier','acceptance','human']), objective: z.string().min(8),
  agentSelector: z.object({ requiredCapabilities: z.array(z.string()).default([]), preferredAgents: z.array(z.string()).default([]) }),
  workspace: z.object({ mode: z.enum(['readonly','worktree','integration']), readGlobs: z.array(z.string()), writeGlobs: z.array(z.string()) }),
  inputs: z.array(z.string()), outputs: z.array(ArtifactContract), acceptanceChecks: z.array(AcceptanceCheck),
  retryPolicy: z.object({ maxAttempts: z.number().int().min(1).max(10), freshSession: z.boolean(), backoffMs: z.number().int().min(0).max(60_000).default(0) }),
  timeoutSeconds: z.number().int().min(1).max(86_400), verifierPolicy: z.object({ required: z.boolean(), freshSession: z.boolean(), readonly: z.boolean() }),
  approvalPolicy: z.enum(['none','on_permission','always']), irreversible: z.boolean().default(false)
});
export const GraphEdgeV1 = z.object({ from: z.string(), to: z.string(), artifacts: z.array(z.string()), condition: z.string().optional() });
export const GraphSpecV1 = z.object({
  version: z.literal('1.0'), executionMode: z.enum(['single_agent','graph']), goal: z.string().min(1), acceptanceCriteria: z.array(z.string().min(1)).min(1),
  repository: z.object({ root: z.string().min(1), baseRef: z.string().min(1) }),
  policies: z.object({ maxParallel: z.number().int().min(1).max(32), maxGraphDepth: z.number().int().min(1).max(64), maxNodeAttempts: z.number().int().min(1).max(10), maxRuntimeSeconds: z.number().int().min(1), networkPolicy: z.enum(['denied','approval_required','allowed']), nestedSubagents: z.boolean(), approvalPolicy: z.literal('human_required') }),
  nodes: z.array(GraphNodeV1).min(1), edges: z.array(GraphEdgeV1)
});

export type GraphSpec = z.infer<typeof GraphSpecV1>; export type GraphNode = z.infer<typeof GraphNodeV1>; export type GraphEdge = z.infer<typeof GraphEdgeV1>;
export const RunEventType = z.enum(['graph.status','node.status','node.ready','agent.message.delta','agent.plan.snapshot','agent.tool.started','agent.tool.updated','agent.terminal.delta','agent.permission.requested','agent.diff','node.check.started','node.check.completed','node.verification.failed','node.retry.scheduled','artifact.created','approval.requested','run.completed','run.failed']);
export const NormalizedRunEvent = z.object({ eventId:z.string(),sequence:z.number().int().positive(),timestamp:z.string(),projectId:z.string(),graphId:z.string(),runId:z.string(),nodeId:z.string().nullable(),attempt:z.number().int().min(0),agentId:z.string().nullable(),agentSessionId:z.string().nullable(),type:RunEventType,payload:z.record(z.string(),z.unknown()) });
export type NormalizedRunEvent = z.infer<typeof NormalizedRunEvent>; export type RunEventType = z.infer<typeof RunEventType>;
export const TaskEnvelope = z.object({ runId:z.string(),nodeId:z.string(),attempt:z.number().int().positive(),objective:z.string(),workspace:z.string(),readGlobs:z.array(z.string()),writeGlobs:z.array(z.string()),inputArtifactPaths:z.array(z.string()),outputContract:z.array(ArtifactContract),acceptanceCommands:z.array(z.string()),timeoutSeconds:z.number().positive(),prohibitedOperations:z.array(z.string()) });
export type TaskEnvelope = z.infer<typeof TaskEnvelope>;
export const NodeResult = z.object({ status:z.enum(['completed','failed','cancelled']),summary:z.string(),changedFiles:z.array(z.string()),artifacts:z.array(z.object({name:z.string(),path:z.string()})),evidence:z.array(z.object({type:z.string(),command:z.string().optional(),exitCode:z.number().optional()})) });
export const VerificationResult = z.object({ accepted:z.boolean(),sessionId:z.string(),reasons:z.array(z.string()),checkedArtifacts:z.array(z.string()) });
export type NodeResult = z.infer<typeof NodeResult>; export type VerificationResult = z.infer<typeof VerificationResult>;
export type RunState={runId:string;graphVersion:string;repoRef:string;nodeIndex:Record<string,string>;artifactIndex:Record<string,{path:string;hash:string}>;budgetState:{startedAt:string;attempts:number};decisionFlags:Record<string,boolean|string>;finalStatus:string};
