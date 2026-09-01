import type { GraphNode, GraphSpec } from "../../contracts/src/index.ts";

type DemoNodeInput = Partial<GraphNode> &
  Pick<GraphNode, "id" | "title" | "kind" | "objective" | "inputs" | "outputs">;

function createDemoNode(value: DemoNodeInput): GraphNode {
  return {
    agentSelector: {
      requiredCapabilities: ["filesystem.read", "terminal"],
      preferredAgents: ["mock"],
    },
    workspace: {
      mode: "readonly",
      readGlobs: ["**"],
      writeGlobs: [],
    },
    acceptanceChecks: [
      {
        type: "artifact",
        description: "Required artifact is present",
        frozen: true,
      },
    ],
    retryPolicy: {
      maxAttempts: 1,
      freshSession: true,
      backoffMs: 0,
    },
    timeoutSeconds: 20,
    verifierPolicy: {
      required: false,
      freshSession: true,
      readonly: true,
    },
    approvalPolicy: "none",
    irreversible: false,
    ...value,
  };
}

export function createDemoSpec(
  root: string,
  goal = "Build and verify a resilient feature in the sample repository",
): GraphSpec {
  return {
    version: "1.0",
    executionMode: "graph",
    goal,
    goalCharter: {
      strategic:
        "Deliver a resilient sample feature without sacrificing auditability or human approval boundaries.",
      medium:
        "Integration survives adversarial review on diff and cross-module evidence, not only scoped unit tests.",
      fast:
        "Parallel workers complete in isolated worktrees with passing scoped tests and named artifacts.",
    },
    acceptanceCriteria: [
      "Both parallel workers complete",
      "A failed verification retries in a fresh session",
      "Integration and final acceptance succeed",
    ],
    repository: {
      root,
      baseRef: "main",
    },
    policies: {
      maxParallel: 2,
      maxGraphDepth: 8,
      maxNodeAttempts: 2,
      maxRuntimeSeconds: 120,
      networkPolicy: "approval_required",
      nestedSubagents: false,
      approvalPolicy: "human_required",
      acceptanceFrozen: true,
    },
    nodes: [
      createDemoNode({
        id: "analyze_repo",
        title: "Map repository",
        kind: "analysis",
        objective:
          "Inspect repository boundaries and emit an explicit implementation map.",
        inputs: ["repo"],
        outputs: [{ name: "repo-map.json", type: "json" }],
      }),
      createDemoNode({
        id: "implement_runtime",
        title: "Runtime & recovery",
        kind: "worker",
        objective:
          "Implement durable runtime behavior in its isolated write scope.",
        inputs: ["repo-map.json"],
        outputs: [{ name: "runtime.patch", type: "git_patch" }],
        workspace: {
          mode: "worktree",
          readGlobs: ["**"],
          writeGlobs: ["src/runtime/**"],
        },
        acceptanceChecks: [
          {
            type: "command",
            command: "npm test",
            description: "Runtime tests pass",
            frozen: true,
          },
        ],
        retryPolicy: {
          maxAttempts: 2,
          freshSession: true,
          backoffMs: 0,
        },
        verifierPolicy: {
          required: true,
          freshSession: true,
          readonly: true,
        },
      }),
      createDemoNode({
        id: "implement_dashboard",
        title: "Review dashboard",
        kind: "worker",
        objective:
          "Implement live review evidence and reconnect behavior; retry once when objective evidence is incomplete.",
        inputs: ["repo-map.json"],
        outputs: [{ name: "dashboard.patch", type: "git_patch" }],
        workspace: {
          mode: "worktree",
          readGlobs: ["**"],
          writeGlobs: ["src/dashboard/**"],
        },
        acceptanceChecks: [
          {
            type: "command",
            command: "npm test",
            description: "Dashboard tests pass",
            frozen: true,
          },
        ],
        retryPolicy: {
          maxAttempts: 2,
          freshSession: true,
          backoffMs: 0,
        },
        verifierPolicy: {
          required: true,
          freshSession: true,
          readonly: true,
        },
      }),
      createDemoNode({
        id: "integrate",
        title: "Integrate artifacts",
        kind: "integration",
        objective:
          "Combine the two isolated patches into an auditable integration result.",
        inputs: ["runtime.patch", "dashboard.patch"],
        outputs: [{ name: "integration.diff", type: "diff" }],
        workspace: {
          mode: "integration",
          readGlobs: ["**"],
          writeGlobs: ["src/**"],
        },
        verifierPolicy: {
          required: true,
          freshSession: true,
          readonly: true,
        },
      }),
      createDemoNode({
        id: "fast_verifier",
        title: "Fast loop verification",
        kind: "verifier",
        objective:
          "Reject the integrated result when scoped worker evidence is incomplete or tests were gamed.",
        inputs: ["integration.diff"],
        outputs: [{ name: "fast-verification.json", type: "json" }],
      }),
      createDemoNode({
        id: "mid_verifier",
        title: "Medium loop verification",
        kind: "verifier",
        objective:
          "Kill a green Fast score when diff integrity, cross-module coupling, or rationale audits fail on different evidence.",
        inputs: ["fast-verification.json", "integration.diff"],
        outputs: [{ name: "mid-verification.json", type: "json" }],
      }),
      createDemoNode({
        id: "acceptance",
        title: "Acceptance suite",
        kind: "acceptance",
        objective:
          "Run the final acceptance suite and publish the complete execution report.",
        inputs: ["mid-verification.json"],
        outputs: [{ name: "run-report.json", type: "test_report" }],
        acceptanceChecks: [
          {
            type: "command",
            command: "npm test",
            description: "Final sample acceptance passes",
            frozen: true,
          },
        ],
      }),
    ],
    edges: [
      {
        from: "analyze_repo",
        to: "implement_runtime",
        artifacts: ["repo-map.json"],
      },
      {
        from: "analyze_repo",
        to: "implement_dashboard",
        artifacts: ["repo-map.json"],
      },
      {
        from: "implement_runtime",
        to: "integrate",
        artifacts: ["runtime.patch"],
      },
      {
        from: "implement_dashboard",
        to: "integrate",
        artifacts: ["dashboard.patch"],
      },
      {
        from: "integrate",
        to: "fast_verifier",
        artifacts: ["integration.diff"],
      },
      {
        from: "fast_verifier",
        to: "mid_verifier",
        artifacts: ["fast-verification.json", "integration.diff"],
      },
      {
        from: "mid_verifier",
        to: "acceptance",
        artifacts: ["mid-verification.json"],
      },
    ],
  };
}
