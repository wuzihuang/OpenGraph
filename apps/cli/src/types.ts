export interface DemoOptions {
  approve?: boolean;
  wait?: boolean;
}

export interface DraftGraphResponse {
  graphId: string;
  dashboardUrl: string;
}

export interface ApprovedGraphResponse {
  runId: string;
}

export interface RunArtifact {
  path: string;
  [key: string]: unknown;
}

export interface RunStatusResponse {
  status: string;
  state: {
    artifactIndex: Record<string, RunArtifact>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface RunEvent {
  type: string;
  [key: string]: unknown;
}
