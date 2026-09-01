import type {
  GraphEdge as ContractGraphEdge,
  GraphNode as ContractGraphNode,
  GraphSpec as ContractGraphSpec,
  NormalizedRunEvent,
} from "../../../packages/contracts/src/index.ts";

export type GraphNode = Pick<
  ContractGraphNode,
  | "id"
  | "title"
  | "objective"
  | "inputs"
  | "outputs"
  | "acceptanceChecks"
  | "timeoutSeconds"
  | "verifierPolicy"
> & {
  kind: string;
  agentSelector: Pick<ContractGraphNode["agentSelector"], "preferredAgents">;
  workspace: Pick<
    ContractGraphNode["workspace"],
    "mode" | "readGlobs" | "writeGlobs"
  >;
  retryPolicy: Pick<ContractGraphNode["retryPolicy"], "maxAttempts">;
};

export type GraphEdge = Pick<ContractGraphEdge, "from" | "to" | "artifacts">;

export type GraphSpec = Pick<
  ContractGraphSpec,
  "goal" | "version" | "goalCharter"
> & {
  repository?: Partial<ContractGraphSpec["repository"]>;
  policies: Pick<ContractGraphSpec["policies"], "maxParallel"> &
    Partial<Omit<ContractGraphSpec["policies"], "maxParallel">>;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type RunEvent = Pick<
  NormalizedRunEvent,
  "sequence" | "type" | "nodeId" | "attempt" | "agentSessionId" | "payload"
>;

export type ValidationIssue = {
  severity: "error" | "warning";
  message?: string;
  path?: string;
  code?: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export type GraphResponse = {
  spec?: GraphSpec;
};

export type CreateGraphResponse = {
  graphId?: string;
  error?: string;
};

export type ApproveGraphResponse = {
  runId?: string;
  error?: string;
  message?: string;
};

export type RunResponse = {
  status: string;
};

export type CardData = {
  title: string;
  subtitle: string;
  kind: string;
  role: string;
  agent: string;
  status: string;
  accent: string;
  outputs: string[];
  streamText?: string;
};

export type NodeComment = {
  id: string;
  graphId: string;
  nodeId: string;
  role: "user" | "system";
  body: string;
  createdAt: string;
};

export type GraphPosition = {
  x: number;
  y: number;
};

export type WorkspaceView = "graph" | "activity" | "agents" | "security";
export type InspectorPanel = "configure" | "comments" | "activity" | "evidence";
export type AppMode = "review" | "run";
