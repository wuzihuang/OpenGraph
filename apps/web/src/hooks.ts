import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ApproveGraphResponse,
  CreateGraphResponse,
  GraphResponse,
  GraphSpec,
  RunEvent,
  RunResponse,
  ValidationResult,
} from "./types.ts";

export function useGraphApi(token: string) {
  const headers = useMemo(
    function createAuthorizationHeaders() {
      return { authorization: `Bearer ${token}` };
    },
    [token],
  );
  const jsonHeaders = useMemo(
    function createJsonHeaders() {
      return { ...headers, "content-type": "application/json" };
    },
    [headers],
  );

  const loadGraph = useCallback(
    async function loadGraph(id: string): Promise<GraphSpec | null> {
      const response = await fetch(`/api/graphs/${id}`, { headers });
      if (!response.ok) return null;
      const graph = (await response.json()) as GraphResponse;
      return graph.spec ?? null;
    },
    [headers],
  );

  const validateGraph = useCallback(
    async function validateGraph(
      spec: GraphSpec,
    ): Promise<ValidationResult | null> {
      try {
        const response = await fetch("/api/graphs/validate", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify(spec),
        });
        return response.ok
          ? ((await response.json()) as ValidationResult)
          : null;
      } catch {
        return null;
      }
    },
    [jsonHeaders],
  );

  const createDemoGraph = useCallback(
    async function createDemoGraph(): Promise<CreateGraphResponse> {
      const response = await fetch("/api/graphs/demo", {
        method: "POST",
        headers,
      });
      const body = (await response.json().catch(function emptyCreateResponse() {
        return {};
      })) as CreateGraphResponse;
      if (!response.ok) {
        throw new Error(
          body.error === "UNAUTHORIZED"
            ? "Session expired — reload the dashboard URL with a valid token"
            : "Could not create demo graph",
        );
      }
      return body;
    },
    [headers],
  );

  const approveGraph = useCallback(
    async function approveGraph(
      graphId: string,
    ): Promise<ApproveGraphResponse> {
      const response = await fetch(`/api/graphs/${graphId}/approve`, {
        method: "POST",
        headers,
      });
      const body = (await response
        .json()
        .catch(function emptyApproveResponse() {
          return {};
        })) as ApproveGraphResponse;
      if (!response.ok || !body.runId) {
        if (body.error === "UNAUTHORIZED") {
          throw new Error(
            "Session expired — reload the dashboard URL with a valid token",
          );
        }
        throw new Error(body.message ?? body.error ?? "Approval failed");
      }
      return body;
    },
    [headers],
  );

  const rejectGraph = useCallback(
    async function rejectGraph(graphId: string): Promise<void> {
      await fetch(`/api/graphs/${graphId}/reject`, { method: "POST", headers });
    },
    [headers],
  );

  const amendGraph = useCallback(
    async function amendGraph(
      graphId: string,
      spec: GraphSpec,
    ): Promise<boolean> {
      const response = await fetch(`/api/graphs/${graphId}/amend`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ spec }),
      });
      return response.ok;
    },
    [jsonHeaders],
  );

  const runAction = useCallback(
    async function runAction(runId: string, action: string): Promise<void> {
      await fetch(`/api/runs/${runId}/${action}`, { method: "POST", headers });
    },
    [headers],
  );

  const reassignNode = useCallback(
    async function reassignNode(runId: string, nodeId: string): Promise<void> {
      await fetch(`/api/runs/${runId}/nodes/${nodeId}/reassign`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ agent: "mock" }),
      });
    },
    [jsonHeaders],
  );

  const retryNode = useCallback(
    async function retryNode(runId: string, nodeId: string): Promise<void> {
      await fetch(`/api/runs/${runId}/nodes/${nodeId}/retry`, {
        method: "POST",
        headers,
      });
    },
    [headers],
  );

  const latestRunForGraph = useCallback(
    async function latestRunForGraph(
      graphId: string,
    ): Promise<{ id: string; status: string } | null> {
      const response = await fetch(`/api/graphs/${graphId}/runs`, { headers });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        runs?: Array<{ id: string; status: string }>;
      };
      return body.runs?.[0] ?? null;
    },
    [headers],
  );

  return {
    headers,
    loadGraph,
    validateGraph,
    createDemoGraph,
    approveGraph,
    rejectGraph,
    amendGraph,
    runAction,
    reassignNode,
    retryNode,
    latestRunForGraph,
  };
}

type RunEventsResult = {
  events: RunEvent[];
  statuses: Record<string, string>;
  runStatus: string;
  resetEvents: () => void;
  setRunStatus: (status: string) => void;
};

export function useRunEvents(
  runId: string | null,
  token: string,
  headers: Record<string, string>,
): RunEventsResult {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [runStatus, setRunStatus] = useState("awaiting_approval");
  const lastSequence = useRef(0);

  const resetEvents = useCallback(function resetEvents(): void {
    lastSequence.current = 0;
    setEvents([]);
    setStatuses({});
  }, []);

  useEffect(
    function connectRunEvents() {
      if (!runId) return;
      let socket: WebSocket | undefined;
      let closed = false;
      let timer: number | undefined;

      function ingest(event: RunEvent): void {
        lastSequence.current = Math.max(lastSequence.current, event.sequence);
        setEvents(function appendUniqueEvent(current) {
          return current.some(function hasSequence(item) {
            return item.sequence === event.sequence;
          })
            ? current
            : [...current, event];
        });
        if (
          event.nodeId &&
          (event.type === "node.status" || event.type === "node.ready")
        ) {
          setStatuses(function updateNodeStatus(current) {
            return {
              ...current,
              [event.nodeId as string]: String(event.payload.status ?? "ready"),
            };
          });
        }
        if (event.type === "run.completed") setRunStatus("completed");
        if (event.type === "run.failed") setRunStatus("failed");
      }

      function connect(): void {
        const protocol = location.protocol === "https:" ? "wss" : "ws";
        socket = new WebSocket(
          `${protocol}://${location.host}/ws/runs/${runId}?token=${encodeURIComponent(token)}&since=${lastSequence.current}`,
        );
        socket.onmessage = function handleSocketMessage(message) {
          ingest(JSON.parse(String(message.data)) as RunEvent);
        };
        socket.onclose = function reconnectSocket() {
          if (!closed) timer = window.setTimeout(connect, 450);
        };
      }

      const poll = window.setInterval(async function pollRun(): Promise<void> {
        try {
          const [eventResponse, runResponse] = await Promise.all([
            fetch(`/api/runs/${runId}/events?after=${lastSequence.current}`, {
              headers,
            }),
            fetch(`/api/runs/${runId}`, { headers }),
          ]);
          if (eventResponse.ok) {
            const polledEvents = (await eventResponse.json()) as RunEvent[];
            for (const event of polledEvents) ingest(event);
          }
          if (runResponse.ok) {
            const row = (await runResponse.json()) as RunResponse & {
              state?: { nodeIndex?: Record<string, string> };
            };
            setRunStatus(row.status);
            if (row.state?.nodeIndex) {
              setStatuses(function mergeNodeIndex(current) {
                return { ...row.state!.nodeIndex!, ...current };
              });
            }
          }
        } catch {
          // The websocket reconnect loop remains the primary recovery path.
        }
      }, 250);

      connect();
      return function disconnectRunEvents() {
        closed = true;
        if (timer !== undefined) clearTimeout(timer);
        clearInterval(poll);
        socket?.close();
      };
    },
    [headers, runId, token],
  );

  return { events, statuses, runStatus, resetEvents, setRunStatus };
}
