import { describe, expect, it } from "vitest";
import { layoutGraphNodes } from "./App.js";

const node = (id: string) => ({
  id,
  title: id,
  kind: "analysis",
  objective: id,
  agentSelector: { preferredAgents: [] },
  workspace: { mode: "readonly", readGlobs: [], writeGlobs: [] },
  inputs: [],
  outputs: [],
  acceptanceChecks: [],
  retryPolicy: { maxAttempts: 1 },
  timeoutSeconds: 60,
  verifierPolicy: { required: false, freshSession: true, readonly: true },
});

describe("layoutGraphNodes", () => {
  it("places dependency layers left-to-right and parallel nodes in separate lanes", () => {
    const nodes = [
      "inventory",
      "correctness",
      "security",
      "synthesis",
      "verify",
      "human",
    ].map(node);
    const edges = [
      { from: "inventory", to: "correctness", artifacts: [] },
      { from: "inventory", to: "security", artifacts: [] },
      { from: "correctness", to: "synthesis", artifacts: [] },
      { from: "security", to: "synthesis", artifacts: [] },
      { from: "synthesis", to: "verify", artifacts: [] },
      { from: "verify", to: "human", artifacts: [] },
    ];
    const positions = layoutGraphNodes(nodes, edges);
    expect(positions.inventory!.x).toBeLessThan(positions.correctness!.x);
    expect(positions.correctness!.x).toBe(positions.security!.x);
    expect(positions.correctness!.y).not.toBe(positions.security!.y);
    expect(positions.synthesis!.x).toBeGreaterThan(positions.security!.x);
    expect(
      new Set(Object.values(positions).map(({ x, y }) => `${x}:${y}`)).size,
    ).toBe(nodes.length);
  });

  it("gives disconnected nodes distinct positions instead of stacking at the origin", () => {
    const nodes = ["one", "two", "three"].map(node),
      positions = layoutGraphNodes(nodes, []);
    expect(
      new Set(Object.values(positions).map(({ x, y }) => `${x}:${y}`)).size,
    ).toBe(3);
    expect(Object.values(positions)).not.toContainEqual({ x: 0, y: 0 });
  });
});
