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
    goalCharter: {
      strategic:
        "Ship a genuinely playable browser game without sacrificing maintainability or honest README instructions.",
      medium:
        "Reject stub implementations and README gaps even when required files exist on disk.",
      fast: "Deliver index.html, style.css, game.js, and README with flap, pipes, collision, score, and restart.",
    },
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
      maxParallel: 2,
      maxGraphDepth: 8,
      maxNodeAttempts: 2,
      maxRuntimeSeconds: 900,
      networkPolicy: "approval_required",
      nestedSubagents: false,
      approvalPolicy: "human_required",
      acceptanceFrozen: true,
    },
    nodes: [
      node({
        id: "strat_game_direction",
        title: "Anchor game direction",
        kind: "analysis",
        objective:
          "Freeze the product direction for a small, genuinely playable vanilla Canvas Flappy Bird game: immediate controls, readable score and state, fair collision, restart, pause, responsive presentation, and honest no-build documentation. Do not modify files.",
        inputs: ["repo"],
        outputs: [{ name: "game-direction.json", type: "json" }],
        timeoutSeconds: 180,
      }),
      node({
        id: "fast_gameplay_design",
        title: "Design gameplay loop",
        kind: "analysis",
        objective:
          "Design the concrete Canvas game loop from the frozen direction: bird physics, flap input, deterministic pipe movement, scoring, collision, pause, game-over, and restart states. Emit an implementation-ready gameplay plan without modifying files.",
        inputs: ["game-direction.json"],
        outputs: [{ name: "gameplay-plan.json", type: "json" }],
        timeoutSeconds: 180,
      }),
      node({
        id: "fast_visual_design",
        title: "Design visual system",
        kind: "analysis",
        objective:
          "Design a compact responsive visual system from the frozen direction: canvas framing, accessible contrast, score and state overlays, control hints, mobile sizing, and a polished arcade feel. Emit an implementation-ready visual plan without modifying files.",
        inputs: ["game-direction.json"],
        outputs: [{ name: "visual-plan.json", type: "json" }],
        timeoutSeconds: 180,
      }),
      node({
        id: "fast_implement_game",
        title: "Implement Flappy Bird",
        kind: "worker",
        objective:
          "Implement both approved plans as a complete playable Flappy Bird game in this worktree: index.html, style.css, and game.js using vanilla JavaScript and Canvas. Support Space/click/tap flap, scrolling pipes, gravity, collision, score, game-over restart, P to pause, responsive sizing, and clear status UI. Update README with exact open and play instructions. No npm dependencies.",
        inputs: ["gameplay-plan.json", "visual-plan.json"],
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
          {
            type: "command",
            command: "node --check game.js",
            description: "game.js has valid JavaScript syntax",
            frozen: true,
          },
          {
            type: "command",
            command:
              "grep -Eqi 'space|click|tap' README.md && grep -Eqi 'pause|restart' README.md",
            description: "README documents core controls",
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
        id: "fast_verifier",
        title: "Fast loop verification",
        kind: "verifier",
        objective:
          "Reject the Flappy Bird result if playable evidence is incomplete: missing files, empty stubs, or broken game loop.",
        inputs: ["game.patch"],
        outputs: [{ name: "fast-verification.json", type: "json" }],
        timeoutSeconds: 180,
      }),
      node({
        id: "mid_verifier",
        title: "Medium loop verification",
        kind: "verifier",
        objective:
          "Kill a green Fast score when README instructions are incomplete, controls are undocumented, or gameplay evidence looks gamed.",
        inputs: ["fast-verification.json", "game.patch"],
        outputs: [{ name: "mid-verification.json", type: "json" }],
        timeoutSeconds: 180,
      }),
      node({
        id: "guard_game_integrity",
        title: "Guard gameplay integrity",
        kind: "verifier",
        objective:
          "Arbitrate Fast delivery against Medium evidence. Reject success if controls are merely documented but not wired, collision or scoring is stubbed, the game cannot restart, syntax checks were bypassed, or the implementation depends on undeclared tooling.",
        inputs: ["mid-verification.json", "game.patch"],
        outputs: [{ name: "guard-verdict.json", type: "json" }],
        acceptanceChecks: [
          {
            type: "artifact",
            description:
              "Guard verdict records physical checks and patch inspection",
            frozen: true,
          },
        ],
        timeoutSeconds: 180,
      }),
      node({
        id: "strat_accept_game",
        title: "Accept Flappy Bird",
        kind: "acceptance",
        objective:
          "Accept only when the Guard verdict shows the implementation is genuinely playable, the Medium loop found no gaming or documentation gap, all physical checks passed, and the result still honors the frozen game direction. Record a concise final report without modifying files.",
        inputs: ["guard-verdict.json", "game.patch"],
        outputs: [{ name: "run-report.json", type: "test_report" }],
        timeoutSeconds: 120,
      }),
    ],
    edges: [
      {
        from: "strat_game_direction",
        to: "fast_gameplay_design",
        artifacts: ["game-direction.json"],
      },
      {
        from: "strat_game_direction",
        to: "fast_visual_design",
        artifacts: ["game-direction.json"],
      },
      {
        from: "fast_gameplay_design",
        to: "fast_implement_game",
        artifacts: ["gameplay-plan.json"],
      },
      {
        from: "fast_visual_design",
        to: "fast_implement_game",
        artifacts: ["visual-plan.json"],
      },
      {
        from: "fast_implement_game",
        to: "fast_verifier",
        artifacts: ["game.patch"],
      },
      {
        from: "fast_verifier",
        to: "mid_verifier",
        artifacts: ["fast-verification.json", "game.patch"],
      },
      {
        from: "mid_verifier",
        to: "guard_game_integrity",
        artifacts: ["mid-verification.json", "game.patch"],
      },
      {
        from: "guard_game_integrity",
        to: "strat_accept_game",
        artifacts: ["guard-verdict.json", "game.patch"],
      },
    ],
  };
}
