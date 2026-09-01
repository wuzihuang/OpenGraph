import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  GraphSpecV1,
  type GraphNode,
  type GraphSpec,
} from "../../contracts/src/index.ts";
import type { LintIssue } from "./lint-codes.ts";

export type LintResult = {
  valid: boolean;
  issues: LintIssue[];
  spec?: GraphSpec;
};

function globPrefix(value: string): string {
  return value.replace(/[*{[].*$/, "").replace(/\/$/, "");
}

function overlaps(first: string, second: string): boolean {
  const firstPrefix = globPrefix(first);
  const secondPrefix = globPrefix(second);

  return (
    firstPrefix === "" ||
    secondPrefix === "" ||
    firstPrefix.startsWith(secondPrefix) ||
    secondPrefix.startsWith(firstPrefix)
  );
}

function reachesVerifier(
  startId: string,
  outgoing: Map<string, string[]>,
  nodes: Map<string, GraphNode>,
): boolean {
  const queue = [...(outgoing.get(startId) ?? [])];
  const seen = new Set<string>([startId]);

  while (queue.length > 0) {
    const nextId = queue.shift();
    if (!nextId || seen.has(nextId)) {
      continue;
    }
    seen.add(nextId);
    if (nodes.get(nextId)?.kind === "verifier") {
      return true;
    }
    queue.push(...(outgoing.get(nextId) ?? []));
  }

  return false;
}

function isFastLoopVerifier(node: GraphNode): boolean {
  return node.kind === "verifier" && /(^fast_|_fast_|^fast$|fast_verifier)/.test(node.id);
}

function isMidLoopVerifier(node: GraphNode): boolean {
  return node.kind === "verifier" && /(^mid_|_mid_|^mid$|mid_verifier)/.test(node.id);
}

function hasStrategicAnchor(nodes: readonly GraphNode[]): boolean {
  return nodes.some(function isAnchor(node): boolean {
    return node.kind === "human" || node.kind === "acceptance";
  });
}

function lintGoalCharter(spec: GraphSpec, issues: LintIssue[]): void {
  const charter = spec.goalCharter;
  const layers: Array<{ key: keyof typeof charter; label: string }> = [
    { key: "strategic", label: "Strategic" },
    { key: "medium", label: "Medium" },
    { key: "fast", label: "Fast" },
  ];

  for (const layer of layers) {
    const value = charter[layer.key]?.trim() ?? "";
    if (value.length < 8) {
      issues.push({
        code: "MISSING_GOAL_CHARTER",
        severity: "error",
        message: `goalCharter.${layer.key} (${layer.label}) must be at least 8 characters`,
      });
    }
  }
}

function lintLoopBodies(spec: GraphSpec, issues: LintIssue[]): void {
  if (spec.executionMode !== "graph" || spec.nodes.length <= 2) {
    return;
  }

  if (!spec.nodes.some(isFastLoopVerifier)) {
    issues.push({
      code: "MISSING_FAST_LOOP",
      severity: "error",
      message:
        "Graph mode requires a Fast loop verifier node (id should include fast, e.g. fast_verifier)",
    });
  }

  if (!spec.nodes.some(isMidLoopVerifier)) {
    issues.push({
      code: "MISSING_MEDIUM_LOOP",
      severity: "error",
      message:
        "Graph mode requires a Medium loop verifier node (id should include mid, e.g. mid_verifier)",
    });
  }

  if (!hasStrategicAnchor(spec.nodes)) {
    issues.push({
      code: "MISSING_STRATEGIC_ANCHOR",
      severity: "error",
      message:
        "Graph mode requires a Strategic anchor node (kind human or acceptance)",
    });
  }
}

export function lintGraphSpec(input: unknown): LintResult {
  const parsed = GraphSpecV1.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: [
        {
          code: "INVALID_GRAPH_SPEC",
          severity: "error",
          message: parsed.error.issues
            .map(function formatIssue(issue) {
              return `${issue.path.join(".")}: ${issue.message}`;
            })
            .join("; "),
        },
      ],
    };
  }

  const spec = parsed.data;
  const issues: LintIssue[] = [];
  const ids = new Set<string>();
  const nodes = new Map<string, GraphNode>();

  if (!existsSync(join(spec.repository.root, ".git"))) {
    issues.push({
      code: "REPOSITORY_NOT_GIT",
      severity: "error",
      message: `repository.root must be a git repository (got ${spec.repository.root})`,
    });
  }

  lintGoalCharter(spec, issues);
  lintLoopBodies(spec, issues);

  for (const node of spec.nodes) {
    if (ids.has(node.id)) {
      issues.push({
        code: "DUPLICATE_NODE_ID",
        severity: "error",
        message: `Duplicate node ${node.id}`,
        nodeIds: [node.id],
      });
    }
    ids.add(node.id);
    nodes.set(node.id, node);
  }

  const incident = new Map(spec.nodes.map((node) => [node.id, 0]));
  const produced = new Map<string, string>();
  const consumed = new Set<string>();

  for (const node of spec.nodes) {
    for (const output of node.outputs) {
      produced.set(output.name, node.id);
    }
  }

  for (const edge of spec.edges) {
    if (!nodes.has(edge.from)) {
      issues.push({
        code: "UNKNOWN_EDGE_SOURCE",
        severity: "error",
        message: `Unknown edge source ${edge.from}`,
      });
    }
    if (!nodes.has(edge.to)) {
      issues.push({
        code: "UNKNOWN_EDGE_TARGET",
        severity: "error",
        message: `Unknown edge target ${edge.to}`,
      });
    }
    if (edge.artifacts.length === 0) {
      issues.push({
        code: "FAKE_EDGE_NO_ARTIFACT",
        severity: "error",
        message: `${edge.from} → ${edge.to} carries no artifact`,
      });
    }
    if (nodes.has(edge.from)) {
      incident.set(edge.from, (incident.get(edge.from) ?? 0) + 1);
    }
    if (nodes.has(edge.to)) {
      incident.set(edge.to, (incident.get(edge.to) ?? 0) + 1);
    }
    for (const artifact of edge.artifacts) {
      consumed.add(artifact);
    }
  }

  if (spec.nodes.length > 1) {
    for (const [id, count] of incident) {
      if (count === 0) {
        issues.push({
          code: "ORPHAN_NODE",
          severity: "error",
          message: `Node ${id} is isolated`,
          nodeIds: [id],
        });
      }
    }
  }

  for (const node of spec.nodes) {
    for (const inputName of node.inputs) {
      if (!produced.has(inputName) && inputName !== "repo") {
        issues.push({
          code: "MISSING_INPUT_PRODUCER",
          severity: "error",
          message: `${node.id} requires ${inputName} with no producer`,
          nodeIds: [node.id],
        });
      }
    }

    const broadResponsibilities = [
      "design",
      "frontend",
      "backend",
      "test",
      "deploy",
    ].filter((word) => node.objective.toLowerCase().includes(word));
    if (broadResponsibilities.length >= 4) {
      issues.push({
        code: "NODE_RESPONSIBILITY_TOO_BROAD",
        severity: "error",
        message: `${node.id} combines too many responsibilities`,
        nodeIds: [node.id],
      });
    }
    if (node.acceptanceChecks.length === 0 && node.kind !== "human") {
      issues.push({
        code: "MISSING_ACCEPTANCE_CHECK",
        severity: "error",
        message: `${node.id} has no acceptance check`,
        nodeIds: [node.id],
      });
    }
    if (
      node.workspace.writeGlobs.length > 0 &&
      (!node.verifierPolicy.required || !node.verifierPolicy.freshSession)
    ) {
      issues.push({
        code: "MISSING_VERIFIER",
        severity: "error",
        message: `${node.id} needs a fresh verifier`,
        nodeIds: [node.id],
      });
    }
    if (
      node.retryPolicy.maxAttempts > spec.policies.maxNodeAttempts ||
      node.retryPolicy.maxAttempts < 1
    ) {
      issues.push({
        code: "INVALID_RETRY_POLICY",
        severity: "error",
        message: `${node.id} retry policy exceeds graph policy`,
        nodeIds: [node.id],
      });
    }
    if (node.irreversible && node.approvalPolicy === "none") {
      issues.push({
        code: "INVALID_APPROVAL_BOUNDARY",
        severity: "error",
        message: `${node.id} is irreversible without approval`,
        nodeIds: [node.id],
      });
    }
  }

  for (const [name, producer] of produced) {
    if (
      !consumed.has(name) &&
      nodes.get(producer)?.kind !== "acceptance" &&
      nodes.get(producer)?.kind !== "verifier"
    ) {
      issues.push({
        code: "UNUSED_OUTPUT",
        severity: "error",
        message: `${name} from ${producer} is unused`,
        nodeIds: [producer],
      });
    }
  }

  const indegree = new Map(spec.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(spec.nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of spec.edges) {
    if (nodes.has(edge.from) && nodes.has(edge.to)) {
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
      outgoing.get(edge.from)?.push(edge.to);
    }
  }

  if (!spec.policies.acceptanceFrozen) {
    issues.push({
      code: "THAWED_ACCEPTANCE",
      severity: "error",
      message:
        "policies.acceptanceFrozen must remain true; thaw only via a new amended graph version",
    });
  }

  for (const node of spec.nodes) {
    const thawedCheck = node.acceptanceChecks.find(
      function isThawed(check): boolean {
        return check.frozen === false;
      },
    );
    if (thawedCheck && node.kind !== "human") {
      issues.push({
        code: "THAWED_ACCEPTANCE",
        severity: "error",
        message: `${node.id} has a non-frozen acceptance check; workers cannot weaken pass criteria`,
        nodeIds: [node.id],
      });
    }

    if (
      node.workspace.writeGlobs.length > 0 &&
      node.kind !== "verifier" &&
      !reachesVerifier(node.id, outgoing, nodes)
    ) {
      issues.push({
        code: "MISSING_SUPERVISOR_PATH",
        severity: "error",
        message: `${node.id} writes code but has no path to an independent verifier node`,
        nodeIds: [node.id],
      });
    }
  }

  const queue = [...indegree]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);
  const levels: string[][] = [];
  let visited = 0;

  while (queue.length > 0) {
    const level = queue.splice(0);
    levels.push(level);
    visited += level.length;

    for (const id of level) {
      for (const next of outgoing.get(id) ?? []) {
        const nextDegree = (indegree.get(next) ?? 0) - 1;
        indegree.set(next, nextDegree);
        if (nextDegree === 0) {
          queue.push(next);
        }
      }
    }
  }

  if (
    visited < spec.nodes.length &&
    !spec.edges.some((edge) =>
      /max_iterations|give_up|dry_round_limit/.test(edge.condition ?? ""),
    )
  ) {
    issues.push({
      code: "UNBOUNDED_CYCLE",
      severity: "error",
      message: "Graph contains an unbounded cycle",
    });
  }

  for (const level of levels) {
    if (level.length > spec.policies.maxParallel) {
      issues.push({
        code: "WIDTH_BUDGET_EXCEEDED",
        severity: "error",
        message: `Ready width ${level.length} exceeds ${spec.policies.maxParallel}`,
        nodeIds: level,
      });
    }

    for (let firstIndex = 0; firstIndex < level.length; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < level.length;
        secondIndex += 1
      ) {
        const firstNode = nodes.get(level[firstIndex]!);
        const secondNode = nodes.get(level[secondIndex]!);
        if (
          firstNode &&
          secondNode &&
          firstNode.workspace.writeGlobs.some((firstGlob) =>
            secondNode.workspace.writeGlobs.some((secondGlob) =>
              overlaps(firstGlob, secondGlob),
            ),
          )
        ) {
          issues.push({
            code: "PARALLEL_WRITESET_CONFLICT",
            severity: "error",
            message: `${firstNode.id} and ${secondNode.id} have overlapping write scopes`,
            nodeIds: [firstNode.id, secondNode.id],
          });
        }
      }
    }
  }

  if (spec.executionMode === "graph" && spec.nodes.length <= 2) {
    issues.push({
      code: "SINGLE_AGENT_RECOMMENDED",
      severity: "warning",
      message: "This small graph may be cheaper as single_agent",
    });
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues,
    spec,
  };
}
