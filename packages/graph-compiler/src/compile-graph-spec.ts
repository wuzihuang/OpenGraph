import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import { z } from "zod";
import type {
  GraphNode,
  GraphSpec,
  RunState,
} from "../../contracts/src/index.ts";
import { lintGraphSpec } from "./lint-graph-spec.ts";

const RuntimeState = new StateSchema({
  runId: z.string(),
  graphVersion: z.string(),
  repoRef: z.string(),
  nodeIndex: z.record(z.string(), z.string()),
  artifactIndex: z.record(
    z.string(),
    z.object({
      path: z.string(),
      hash: z.string(),
    }),
  ),
  budgetState: z.object({
    startedAt: z.string(),
    attempts: z.number(),
  }),
  decisionFlags: z.record(z.string(), z.union([z.boolean(), z.string()])),
  finalStatus: z.string(),
});

type GraphRunner = (
  node: GraphNode,
  state: RunState,
) => Promise<Partial<RunState>>;

type CompiledRuntimeGraph = ReturnType<
  InstanceType<typeof StateGraph>["compile"]
>;

type DynamicGraphBuilder = {
  addNode(name: string, action: typeof RuntimeState.Node): void;
  addEdge(source: string, target: string): void;
  compile(): CompiledRuntimeGraph;
};

export function compileGraphSpec(
  spec: GraphSpec,
  runner: GraphRunner,
): CompiledRuntimeGraph {
  const validation = lintGraphSpec(spec);
  if (!validation.valid) {
    throw new Error(
      `Invalid GraphSpec: ${validation.issues.map((issue) => issue.code).join(", ")}`,
    );
  }

  const graph = new StateGraph(RuntimeState) as unknown as DynamicGraphBuilder;

  for (const node of spec.nodes) {
    async function runNode(state: RunState): Promise<Partial<RunState>> {
      return runner(node, state);
    }

    graph.addNode(node.id, runNode);
  }

  const incoming = new Set(spec.edges.map((edge) => edge.to));
  for (const node of spec.nodes) {
    if (!incoming.has(node.id)) {
      graph.addEdge(START, node.id);
    }
  }

  for (const edge of spec.edges) {
    graph.addEdge(edge.from, edge.to);
  }

  const outgoing = new Set(spec.edges.map((edge) => edge.from));
  for (const node of spec.nodes) {
    if (!outgoing.has(node.id)) {
      graph.addEdge(node.id, END);
    }
  }

  return graph.compile();
}
