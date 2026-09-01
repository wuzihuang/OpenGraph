import type { GraphNode, GraphSpec } from "../../contracts/src/index.ts";

type NodeInput = Partial<GraphNode> &
  Pick<GraphNode, "id" | "title" | "kind" | "objective" | "inputs" | "outputs">;

function node(value: NodeInput): GraphNode {
  return {
    agentSelector: {
      requiredCapabilities: ["filesystem.read", "terminal"],
      preferredAgents: ["claude"],
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
    timeoutSeconds: 120,
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

/** Focused OpenGraph spec: Claude Code builds a Flappy Bird mini-game. */
export function createFlappyBirdSpec(root: string): GraphSpec {
  return {
    version: "1.0",
    executionMode: "graph",
    goal: "Build a playable Flappy Bird browser mini-game with Claude Code",
    acceptanceCriteria: [
      "index.html, style.css, and game.js exist",
      "The game is playable in a browser without a build step",
      "README documents how to open and play",
    ],
    repository: {
      root,
      baseRef: "main",
    },
    policies: {
      maxParallel: 1,
      maxGraphDepth: 4,
      maxNodeAttempts: 2,
      maxRuntimeSeconds: 900,
      networkPolicy: "approval_required",
      nestedSubagents: false,
      approvalPolicy: "human_required",
      acceptanceFrozen: true,
    },
    nodes: [
      node({
        id: "plan_game",
        title: "Plan Flappy Bird",
        kind: "analysis",
        objective:
          "Inspect this empty repository and print a short implementation plan for a vanilla Canvas Flappy Bird clone (index.html, style.css, game.js, README). Do not create or modify any files in this analysis step.",
        inputs: ["repo"],
        outputs: [{ name: "repo-map.json", type: "json" }],
        timeoutSeconds: 180,
      }),
      node({
        id: "implement_game",
        title: "Implement Flappy Bird",
        kind: "worker",
        objective:
          "Build a complete playable Flappy Bird clone in this worktree: index.html, style.css, and game.js using vanilla JS + Canvas. Support Space/click/tap flap, scrolling pipes, gravity, collision, score, Game Over restart, and P to pause. Update README with how to play. No npm dependencies.",
        inputs: ["repo-map.json"],
        outputs: [{ name: "game.patch", type: "git_patch" }],
        workspace: {
          mode: "worktree",
          readGlobs: ["**"],
          writeGlobs: ["**"],
        },
        acceptanceChecks: [
          {
            type: "command",
            command: "test -f index.html",
            description: "index.html exists",
            frozen: true,
          },
          {
            type: "command",
            command: "test -f game.js",
            description: "game.js exists",
            frozen: true,
          },
          {
            type: "command",
            command: "test -f style.css",
            description: "style.css exists",
            frozen: true,
          },
        ],
        retryPolicy: {
          maxAttempts: 2,
          freshSession: true,
          backoffMs: 0,
        },
        timeoutSeconds: 600,
        verifierPolicy: {
          required: true,
          freshSession: true,
          readonly: true,
        },
      }),
      node({
        id: "fresh_verify",
        title: "Fresh verification",
        kind: "verifier",
        objective:
          "Reject the Flappy Bird result if playable evidence is incomplete: missing files, empty stubs, or README that does not explain how to open and play.",
        inputs: ["game.patch"],
        outputs: [{ name: "verification.json", type: "json" }],
        timeoutSeconds: 180,
      }),
      node({
        id: "accept_game",
        title: "Accept Flappy Bird",
        kind: "acceptance",
        objective:
          "Summarize that the Flappy Bird implementation passed physical checks and record final acceptance. Do not modify files.",
        inputs: ["verification.json"],
        outputs: [{ name: "run-report.json", type: "test_report" }],
        timeoutSeconds: 120,
      }),
    ],
    edges: [
      {
        from: "plan_game",
        to: "implement_game",
        artifacts: ["repo-map.json"],
      },
      {
        from: "implement_game",
        to: "fresh_verify",
        artifacts: ["game.patch"],
      },
      {
        from: "fresh_verify",
        to: "accept_game",
        artifacts: ["verification.json"],
      },
    ],
  };
}
