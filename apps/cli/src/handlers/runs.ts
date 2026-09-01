import type { CliContext } from "../context.ts";

export async function showRun(
  context: CliContext,
  runId: string,
): Promise<void> {
  const run = await context.api.request<unknown>(`/api/runs/${runId}`);
  console.log(JSON.stringify(run, null, 2));
}

export async function cancelRun(
  context: CliContext,
  runId: string,
): Promise<void> {
  await updateRun(context, runId, "cancel");
}

export async function resumeRun(
  context: CliContext,
  runId: string,
): Promise<void> {
  await updateRun(context, runId, "resume");
}

async function updateRun(
  context: CliContext,
  runId: string,
  action: "cancel" | "resume",
): Promise<void> {
  const run = await context.api.request<unknown>(
    `/api/runs/${runId}/${action}`,
    { method: "POST" },
  );
  console.log(JSON.stringify(run, null, 2));
}
