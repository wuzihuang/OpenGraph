import { useEffect, useState } from "react";
import { fallbackSpec } from "./fallback-spec.ts";
import { useGraphApi, useRunEvents } from "./hooks.ts";
import type {
  AppMode,
  GraphNode,
  GraphSpec,
  InspectorPanel,
  ValidationResult,
  WorkspaceView,
} from "./types.ts";

const validValidation: ValidationResult = { valid: true, issues: [] };

function readDashboardParams(): {
  token: string;
  graphId: string | null;
  runId: string | null;
} {
  const params = new URLSearchParams(location.search);
  return {
    token: params.get("token") ?? "",
    graphId: params.get("graph"),
    runId: params.get("run"),
  };
}

function findActiveNode(
  spec: GraphSpec,
  selected: string,
): GraphNode | undefined {
  return (
    spec.nodes.find(function isSelectedNode(node) {
      return node.id === selected;
    }) ?? spec.nodes[0]
  );
}

export function useDashboardController() {
  const [params] = useState(readDashboardParams);
  const [spec, setSpec] = useState<GraphSpec>(fallbackSpec);
  const [graphId, setGraphId] = useState<string | null>(params.graphId);
  const [runId, setRunId] = useState<string | null>(params.runId);
  const [mode, setMode] = useState<AppMode>(params.runId ? "run" : "review");
  const [selected, setSelected] = useState("implement_runtime");
  const [validation, setValidation] =
    useState<ValidationResult>(validValidation);
  const [panel, setPanel] = useState<InspectorPanel>("configure");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("graph");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const api = useGraphApi(params.token);
  const runEvents = useRunEvents(runId, params.token, api.headers);

  useEffect(
    function loadSelectedGraph() {
      if (!graphId) return;
      void api.loadGraph(graphId).then(async function applyLoadedGraph(graph) {
        if (!graph) return;
        setSpec(graph);
        const result = await api.validateGraph(graph);
        setValidation(result ?? validValidation);
      });
    },
    [api.loadGraph, api.validateGraph, graphId],
  );

  useEffect(
    function dismissNotice() {
      if (!notice) return;
      const timer = window.setTimeout(function clearNotice() {
        setNotice(null);
      }, 2600);
      return function cancelNoticeTimer() {
        clearTimeout(timer);
      };
    },
    [notice],
  );

  async function validate(next: GraphSpec): Promise<void> {
    setSpec(next);
    const result = await api.validateGraph(next);
    setValidation(result ?? validValidation);
  }

  async function approve(): Promise<void> {
    if (approving) return;
    if (
      validation.issues.some(function isError(issue) {
        return issue.severity === "error";
      })
    ) {
      setNotice("Fix validation errors before starting");
      return;
    }
    setApproving(true);
    try {
      let activeGraphId = graphId;
      if (!activeGraphId) {
        const created = await api.createDemoGraph();
        if (!created.graphId) throw new Error("Demo graph missing id");
        activeGraphId = created.graphId;
        setGraphId(activeGraphId);
        const loaded = await api.loadGraph(activeGraphId);
        if (loaded) setSpec(loaded);
      }
      const data = await api.approveGraph(activeGraphId);
      if (!data.runId) throw new Error("Approval failed");
      runEvents.resetEvents();
      setRunId(data.runId);
      setMode("run");
      runEvents.setRunStatus("running");
      setWorkspaceView("graph");
      setPanel("activity");
      setNotice("Run started");
      history.replaceState(
        null,
        "",
        `?token=${encodeURIComponent(params.token)}&graph=${activeGraphId}&run=${data.runId}`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not start run");
    } finally {
      setApproving(false);
    }
  }

  async function startOrShowRun(): Promise<void> {
    if (runId) {
      setMode("run");
      return;
    }
    await approve();
  }

  async function reject(): Promise<void> {
    if (graphId) await api.rejectGraph(graphId);
    runEvents.setRunStatus("rejected");
  }

  async function saveAmendment(): Promise<void> {
    if (!graphId || !validation.valid) return;
    try {
      const saved = await api.amendGraph(graphId, spec);
      if (!saved) throw new Error("Amendment failed");
      const loaded = await api.loadGraph(graphId);
      if (loaded) setSpec(loaded);
      setNotice("Graph version saved");
    } catch {
      setNotice("Could not save graph version");
    }
  }

  async function performRunAction(action: string): Promise<void> {
    if (!runId) return;
    await api.runAction(runId, action);
    runEvents.setRunStatus(
      action === "cancel"
        ? "cancelled"
        : action === "pause"
          ? "paused"
          : "running",
    );
  }

  function selectNode(id: string): void {
    setSelected(id);
    setWorkspaceView("graph");
    setInspectorOpen(true);
    setSearchOpen(false);
    setSearchQuery("");
  }

  function updateActive(change: Partial<GraphNode>): void {
    const active = findActiveNode(spec, selected);
    if (!active) return;
    const nodes = spec.nodes.map(function updateSelectedNode(node) {
      return node.id === active.id ? { ...node, ...change } : node;
    });
    void validate({ ...spec, nodes });
  }

  async function reassignActiveNode(): Promise<void> {
    const active = findActiveNode(spec, selected);
    if (!runId || !active) return;
    await api.reassignNode(runId, active.id);
  }

  async function retryActiveNode(): Promise<void> {
    const active = findActiveNode(spec, selected);
    if (!runId || !active) return;
    await api.retryNode(runId, active.id);
  }

  return {
    spec,
    graphId,
    runId,
    mode,
    selected,
    validation,
    panel,
    workspaceView,
    inspectorOpen,
    searchOpen,
    searchQuery,
    notice,
    approving,
    events: runEvents.events,
    statuses: runEvents.statuses,
    runStatus: runEvents.runStatus,
    setMode,
    setPanel,
    setWorkspaceView,
    setInspectorOpen,
    setSearchOpen,
    setSearchQuery,
    approve,
    startOrShowRun,
    reject,
    saveAmendment,
    performRunAction,
    selectNode,
    updateActive,
    reassignActiveNode,
    retryActiveNode,
  };
}
