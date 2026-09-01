import { lintGraphSpec } from "../../../../packages/graph-compiler/src/index.ts";
import { createDemoSpec } from "../../../../packages/graph-runtime/src/demo.ts";
import type { CliContext } from "../context.ts";

export async function planGraph(
  context: CliContext,
  goal: string,
): Promise<void> {
  const spec = createDemoSpec(process.cwd(), goal);
  const validation = lintGraphSpec(spec);
  if (!validation.valid) {
    throw new Error("Generated GraphSpec failed validation");
  }

  const published = await context.api.request<unknown>("/api/graphs/publish", {
    method: "POST",
    body: JSON.stringify({ spec }),
  });
  console.log(JSON.stringify(published, null, 2));
}

export async function listGraphs(context: CliContext): Promise<void> {
  const graphs = await context.api.request<unknown>("/api/graphs");
  console.log(JSON.stringify(graphs, null, 2));
}

export async function showGraph(
  context: CliContext,
  graphId: string,
): Promise<void> {
  const graph = await context.api.request<unknown>(`/api/graphs/${graphId}`);
  console.log(JSON.stringify(graph, null, 2));
}

export async function approveGraph(
  context: CliContext,
  graphId: string,
): Promise<void> {
  const graph = await context.api.request<unknown>(
    `/api/graphs/${graphId}/approve`,
    { method: "POST" },
  );
  console.log(JSON.stringify(graph, null, 2));
}
