import { useEffect, useState } from "react";
import { fallbackSpec } from "./fallback-spec.ts";
import { useGraphApi, useRunEvents } from "./hooks.ts";
import type {
  AppMode,
  GraphNode,
  GraphSpec,
  InspectorPanel,
  ValidationResult,
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

function replaceRunInUrl(token: string, graphId: string, runId: string): void {
  history.replaceState(
    null,
    "",
    `?token=${encodeURIComponent(token)}&graph=${encodeURIComponent(graphId)}&run=${encodeURIComponent(runId)}`,
  );
}

export function useDashboardController() {
  const [params] = useState(readDashboardParams);
  const [spec, setSpec] = useState<GraphSpec>(fallbackSpec);
  const graphId = params.graphId;
  const [runId, setRunId] = useState<string | null>(params.runId);
  const [mode, setMode] = useState<AppMode>(params.runId ? "run" : "review");
  const [selected, setSelected] = useState("implement_runtime");
  const [validation, setValidation] =
    useState<ValidationResult>(validValidation);
  const [panel, setPanel] = useState<InspectorPanel>("comments");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
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
        if (graph.nodes[0]?.id) {
          setSelected(graph.nodes[0].id);
        }
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

  async function showRun(): Promise<void> {
    if (!graphId) {
      setNotice("Open a published graph before switching to Live");
      return;
    }

    let activeRunId = runId;
    if (!activeRunId) {
      const latest = await api.latestRunForGraph(graphId);
      if (!latest) {
        setNotice("No run yet — start execution from your coding agent");
        return;
      }
      activeRunId = latest.id;
      runEvents.resetEvents();
      setRunId(activeRunId);
      runEvents.setRunStatus(latest.status);
      replaceRunInUrl(params.token, graphId, activeRunId);
    }

    setMode("run");
    setPanel("activity");
    setInspectorOpen(true);
    setNotice(`Live · ${activeRunId.slice(-10)} · ${runEvents.runStatus}`);
  }

  function showReview(): void {
    setMode("review");
  }

  async function saveAmendment(): Promise<void> {
    if (!graphId || !validation.valid) {
      setNotice("Fix validation errors before saving");
      return;
    }
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

  function selectNode(id: string): void {
    setSelected(id);
    setPassportOpen(true);
    setSearchOpen(false);
    setSearchQuery("");
  }

  function closePassport(): void {
    setPassportOpen(false);
  }

  function openInspectorPanel(next: InspectorPanel): void {
    setPanel(next);
    setInspectorOpen(true);
    setPassportOpen(true);
  }

  function updateActive(change: Partial<GraphNode>): void {
    const active = findActiveNode(spec, selected);
    if (!active) return;
    const nodes = spec.nodes.map(function updateSelectedNode(node) {
      return node.id === active.id ? { ...node, ...change } : node;
    });
    void validate({ ...spec, nodes });
  }

  return {
    token: params.token,
    spec,
    graphId,
    runId,
    mode,
    selected,
    validation,
    panel,
    inspectorOpen,
    passportOpen,
    searchOpen,
    searchQuery,
    notice,
    events: runEvents.events,
    statuses: runEvents.statuses,
    runStatus: runEvents.runStatus,
    setPanel,
    setInspectorOpen,
    setSearchOpen,
    setSearchQuery,
    showReview,
    showRun,
    saveAmendment,
    selectNode,
    closePassport,
    openInspectorPanel,
    updateActive,
  };
}
