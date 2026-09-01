import type { FastifyInstance } from "fastify";
import type { DaemonContext, IdParams, WebSocketQuery } from "./types.ts";

export function registerWebSocketRoutes(
  app: FastifyInstance,
  context: DaemonContext,
): void {
  app.get<{ Params: IdParams; Querystring: WebSocketQuery }>(
    "/ws/runs/:id",
    { websocket: true },
    function streamRunEvents(socket, request) {
      const runId = request.params.id;
      const since = Number(request.query.since ?? 0);

      for (const event of context.store.eventsAfter(runId, since)) {
        socket.send(JSON.stringify(event));
      }

      const unsubscribe = context.runtime.subscribe(
        function sendRunEvent(event) {
          if (event.runId === runId && socket.readyState === 1) {
            socket.send(JSON.stringify(event));
          }
        },
      );

      socket.on("close", unsubscribe);
    },
  );
}
