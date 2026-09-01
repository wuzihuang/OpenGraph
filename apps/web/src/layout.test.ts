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
  it("places dependency layers top-to-bottom in a diamond spread", () => {
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
    expect(positions.inventory!.y).toBeLessThan(positions.correctness!.y);
    expect(positions.correctness!.y).toBe(positions.security!.y);
    expect(positions.correctness!.x).not.toBe(positions.security!.x);
    expect(positions.synthesis!.y).toBeGreaterThan(positions.security!.y);
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

  it("spreads supervised loops around a central governance area", () => {
    const nodes = [
      "fast_worker",
      "fast_verifier",
      "mid_audit",
      "mid_verifier",
      "guard_integrity",
      "strat_acceptance",
    ].map(node);
    const edges = [
      { from: "fast_worker", to: "fast_verifier", artifacts: [] },
      { from: "fast_verifier", to: "mid_audit", artifacts: [] },
      { from: "mid_audit", to: "mid_verifier", artifacts: [] },
      { from: "mid_verifier", to: "guard_integrity", artifacts: [] },
      { from: "guard_integrity", to: "strat_acceptance", artifacts: [] },
    ];
    const positions = layoutGraphNodes(nodes, edges);

    expect(positions.fast_worker!.y).toBeLessThan(positions.mid_audit!.y);
    expect(positions.mid_audit!.x).toBeLessThan(positions.guard_integrity!.x);
    expect(positions.strat_acceptance!.x).toBeGreaterThan(
      positions.guard_integrity!.x,
    );
  });
});
