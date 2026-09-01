import { createInterface } from "node:readline";
import type { TaskEnvelope } from "../../contracts/src/index.ts";
import type { AcpUpdate } from "../../acp-client/src/index.ts";
import { MockAcpAgent } from "./index.ts";

type MockAgentRequest = {
  id: unknown;
  method: string;
  params: {
    sessionId: string;
    envelope: TaskEnvelope;
  };
};

const agent = new MockAcpAgent();
const lines = createInterface({
  input: process.stdin,
});

function send(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function sendUpdate(update: AcpUpdate): void {
  send({
    method: "session/update",
    params: update,
  });
}

async function handleLine(line: string): Promise<void> {
  const request = JSON.parse(line) as MockAgentRequest;

  switch (request.method) {
    case "initialize":
      send({
        id: request.id,
        result: agent.initialize(),
      });
      break;
    case "session/new":
      send({
        id: request.id,
        result: {
          sessionId: agent.newSession(),
        },
      });
      break;
    case "session/cancel":
      agent.cancel(request.params.sessionId);
      send({
        id: request.id,
        result: {
          cancelled: true,
        },
      });
      break;
    case "session/prompt": {
      const result = await agent.execute(
        request.params.envelope,
        request.params.sessionId,
        sendUpdate,
      );
      send({
        id: request.id,
        result,
      });
      break;
    }
  }
}

lines.on("line", handleLine);
