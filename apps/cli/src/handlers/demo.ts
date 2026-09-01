import { readFileSync } from "node:fs";
import { startDaemon } from "../../../../packages/daemon-core/src/index.ts";
import type { CliContext } from "../context.ts";
import type {
  ApprovedGraphResponse,
  DemoOptions,
  DraftGraphResponse,
  RunEvent,
  RunStatusResponse,
} from "../types.ts";

const activeRunStatuses = ["pending", "running", "paused"];

export async function runDemo(
  context: CliContext,
  options: DemoOptions,
): Promise<void> {
  let ownedDaemon: Awaited<ReturnType<typeof startDaemon>> | null = null;

  try {
    await fetch(`${context.baseUrl}/api/health`);
  } catch {
    ownedDaemon = await startDaemon({ dataDir: context.dataDir });
  }

  const draft = await context.api.request<DraftGraphResponse>(
    "/api/graphs/demo",
    { method: "POST" },
  );
  console.log(`Draft Graph: ${draft.graphId}`);
  console.log(`Dashboard: ${draft.dashboardUrl}`);
  console.log("Status: awaiting human approval");

  if (!options.approve) {
    console.log(`Approve with: graphctl graph approve ${draft.graphId}`);
    return;
  }

  const approved = await context.api.request<ApprovedGraphResponse>(
    `/api/graphs/${draft.graphId}/approve`,
    { method: "POST" },
  );
  console.log(`Run: ${approved.runId}`);

  if (options.wait) {
    await printCompletedRun(context, approved.runId);
    if (ownedDaemon) {
      await ownedDaemon.app.close();
      ownedDaemon.store.close();
    }
  }
}

async function printCompletedRun(
  context: CliContext,
  runId: string,
): Promise<void> {
  let status: RunStatusResponse;
  do {
    await waitForPollingInterval();
    status = await context.api.request<RunStatusResponse>(`/api/runs/${runId}`);
  } while (activeRunStatuses.includes(status.status));

  const events = await context.api.request<RunEvent[]>(
    `/api/runs/${runId}/events`,
  );
  const finalArtifact = status.state.artifactIndex["run-report.json"];
  const report: unknown = finalArtifact
    ? JSON.parse(readFileSync(finalArtifact.path, "utf8"))
    : null;

  console.log(
    JSON.stringify(
      {
        status: status.status,
        finalArtifact,
        report,
        events: events.length,
        retried: events.some(function isRetryEvent(event) {
          return event.type === "node.retry.scheduled";
        }),
      },
      null,
      2,
    ),
  );
}

async function waitForPollingInterval(): Promise<void> {
  await new Promise<void>(function schedule(resolve) {
    setTimeout(resolve, 50);
  });
}
