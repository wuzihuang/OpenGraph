import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  NodeResult,
  TaskEnvelope,
  VerificationResult,
} from "../../contracts/src/index.ts";
import type { AcpUpdate } from "../../acp-client/src/index.ts";

type MockSession = {
  cancelled: boolean;
  role: string;
};

type EmitUpdate = (update: AcpUpdate) => void;

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("ACP_CANCELLED"));
      },
      { once: true },
    );
  });
}

function failedResult(): NodeResult {
  return {
    status: "failed",
    summary: "Controlled mock failure",
    changedFiles: [],
    artifacts: [],
    evidence: [],
  };
}

function cancelledResult(): NodeResult {
  return {
    status: "cancelled",
    summary: "Cancelled by runtime",
    changedFiles: [],
    artifacts: [],
    evidence: [],
  };
}

function changedFilesFor(envelope: TaskEnvelope): string[] {
  if (envelope.writeGlobs.length === 0) {
    return [];
  }

  const firstWriteGlob = envelope.writeGlobs[0]!;
  return [firstWriteGlob.replace(/\/\*\*.*$/, "/mock-output.ts")];
}

async function writeMockOutputs(
  envelope: TaskEnvelope,
  changedFiles: string[],
): Promise<void> {
  for (const file of changedFiles) {
    const path = join(envelope.workspace, file);
    const exportName = envelope.nodeId.replace(/-/g, "_");

    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(
      path,
      `export const ${exportName}Attempt = ${envelope.attempt};\n`,
    );
  }
}

function emitInitialPlan(emit: EmitUpdate): void {
  emit({
    kind: "plan",
    payload: {
      entries: [
        {
          content: "Inspect explicit inputs and workspace policy",
          status: "in_progress",
        },
        {
          content: "Produce contracted artifact",
          status: "pending",
        },
        {
          content: "Run physical checks",
          status: "pending",
        },
      ],
    },
  });
}

function emitCompletedPlan(emit: EmitUpdate): void {
  emit({
    kind: "plan",
    payload: {
      entries: [
        {
          content: "Inspect explicit inputs and workspace policy",
          status: "completed",
        },
        {
          content: "Produce contracted artifact",
          status: "completed",
        },
        {
          content: "Run physical checks",
          status: "completed",
        },
      ],
    },
  });
}

function completedResult(
  envelope: TaskEnvelope,
  changedFiles: string[],
): NodeResult {
  return {
    status: "completed",
    summary: `Completed ${envelope.nodeId}`,
    changedFiles,
    artifacts: envelope.outputContract.map((item) => ({
      name: item.name,
      path: `${envelope.workspace}/${item.name}`,
    })),
    evidence: envelope.acceptanceCommands.map((command) => ({
      type: "command",
      command,
      exitCode: 0,
    })),
  };
}

export class MockAcpAgent {
  readonly sessions = new Map<string, MockSession>();

  initialize() {
    return {
      protocolVersion: "1",
      capabilities: {
        sessionResume: true,
        toolCalls: true,
        terminalStream: true,
        fileEdits: true,
        plans: true,
      },
    };
  }

  newSession(role = "worker"): string {
    const id = `mock_${role}_${randomUUID()}`;
    this.sessions.set(id, {
      cancelled: false,
      role,
    });
    return id;
  }

  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cancelled = true;
    }
  }

  async execute(
    envelope: TaskEnvelope,
    sessionId: string,
    emit: EmitUpdate,
    signal?: AbortSignal,
  ): Promise<NodeResult> {
    emitInitialPlan(emit);
    await wait(25, signal);

    emit({
      kind: "message",
      payload: {
        delta: `Starting ${envelope.nodeId} in isolated session.`,
      },
    });

    if (envelope.objective.includes("[permission]")) {
      emit({
        kind: "permission",
        payload: {
          operation: "network",
          status: "requested",
        },
      });
    }

    emit({
      kind: "tool_started",
      payload: {
        tool: "read_files",
        title: "Read contracted inputs",
      },
    });
    await wait(20, signal);
    emit({
      kind: "tool_updated",
      payload: {
        tool: "read_files",
        status: "completed",
      },
    });

    if (envelope.objective.includes("[fail]")) {
      return failedResult();
    }

    if (envelope.objective.includes("[delay]")) {
      await wait(1_500, signal);
    }

    if (signal?.aborted || this.sessions.get(sessionId)?.cancelled) {
      return cancelledResult();
    }

    const changedFiles = changedFilesFor(envelope);
    await writeMockOutputs(envelope, changedFiles);

    emit({
      kind: "terminal",
      payload: {
        delta: `mock-agent: executing ${envelope.acceptanceCommands.join(", ") || "artifact checks"}\n`,
      },
    });
    emit({
      kind: "diff",
      payload: {
        summary: `Generated ${envelope.outputContract.map((item) => item.name).join(", ")}`,
      },
    });
    emitCompletedPlan(emit);

    return completedResult(envelope, changedFiles);
  }

  async verify(
    nodeId: string,
    attempt: number,
    sessionId: string,
    artifacts: string[],
  ): Promise<VerificationResult> {
    await wait(20);
    const deliberateRejection =
      nodeId === "implement_dashboard" && attempt === 1;

    return {
      accepted: !deliberateRejection,
      sessionId,
      reasons: deliberateRejection
        ? ["Dashboard reconnect evidence missing on first attempt"]
        : [],
      checkedArtifacts: artifacts,
      rejectionKind: deliberateRejection ? "supervision_rejected" : undefined,
    };
  }
}
