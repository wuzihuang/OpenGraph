import type { GraphNode } from "./graph-spec.ts";

/** Supervision role used for review coloring and planner guidance. */
export const NodeSupervisionRole = [
  "execute",
  "supervise",
  "accept",
  "anchor",
] as const;

export type NodeSupervisionRole = (typeof NodeSupervisionRole)[number];

const kindToRole: Record<GraphNode["kind"], NodeSupervisionRole> = {
  analysis: "execute",
  worker: "execute",
  reducer: "execute",
  integration: "execute",
  verifier: "supervise",
  acceptance: "accept",
  human: "anchor",
};

export function supervisionRoleForKind(
  kind: GraphNode["kind"] | string,
): NodeSupervisionRole {
  return kindToRole[kind as GraphNode["kind"]] ?? "execute";
}

/** Review-mode accent colors by supervision role (not run status). */
export function accentForSupervisionRole(role: NodeSupervisionRole): string {
  switch (role) {
    case "supervise":
      return "#c48a2a";
    case "accept":
      return "#2f8f6b";
    case "anchor":
      return "#c4a35a";
    case "execute":
    default:
      return "#1237da";
  }
}
