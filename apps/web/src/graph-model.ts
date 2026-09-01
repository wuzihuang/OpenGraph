import {
  MarkerType,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { useMemo } from "react";
import { supervisionRoleForKind } from "../../../packages/contracts/src/index.ts";
import {
  GraphCard,
  layoutGraphNodes,
  LoopZone,
  type LoopZoneData,
} from "./graph.tsx";
import { reviewAccentForKind, supervisionRoleLabel } from "./node-roles.ts";
import type {
  AppMode,
  CardData,
  GraphNode,
  GraphSpec,
  RunEvent,
  ValidationResult,
} from "./types.ts";

const dashboardNodeTypes: NodeTypes = {
  graphCard: GraphCard,
  loopZone: LoopZone,
};

function createLoopZones(spec: GraphSpec): Node<LoopZoneData>[] {
  const hasFast = spec.nodes.some(function hasFastPrefix(node) {
    return /(^|_)fast(_|$)|loop[_-]?1/i.test(node.id);
  });
  const hasMedium = spec.nodes.some(function hasMediumPrefix(node) {
    return /(^|_)(mid|medium)(_|$)|loop[_-]?2/i.test(node.id);
  });
  const hasStrategic = spec.nodes.some(function hasStrategicNode(node) {
    return (
      /(^|_)(strat|strategic)(_|$)|loop[_-]?3/i.test(node.id) ||
      node.kind === "human" ||
      node.kind === "acceptance"
    );
  });
  if (!hasFast || !hasMedium || !hasStrategic) return [];

  const zones: Node<LoopZoneData>[] = [
    {
      id: "__zone_fast",
      type: "loopZone",
      position: { x: 350, y: -20 },
      data: {
        label: "LOOP 1 · FAST",
        subtitle: "Deliver · test · optimize",
        tone: "fast",
      },
      style: { width: 820, height: 500 },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: -2,
    },
    {
      id: "__zone_medium",
      type: "loopZone",
      position: { x: 10, y: 500 },
      data: {
        label: "LOOP 2 · MEDIUM",
        subtitle: "Challenge method · reject gaming",
        tone: "medium",
      },
      style: { width: 520, height: 440 },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: -2,
    },
    {
      id: "__zone_strategic",
      type: "loopZone",
      position: { x: 850, y: 500 },
      data: {
        label: "LOOP 3 · STRATEGIC",
        subtitle: "Protect direction · human acceptance",
        tone: "strategic",
      },
      style: { width: 520, height: 440 },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: -2,
    },
  ];
  const hasGovernance = spec.nodes.some(function hasGovernancePrefix(node) {
    return /(^|_)(guard|governance|arbiter|integrity|anchor)(_|$)/i.test(
      node.id,
    );
  });
  if (hasGovernance) {
    zones.push({
      id: "__zone_governance",
      type: "loopZone",
      position: { x: 570, y: 555 },
      data: {
        label: "GOVERNANCE CORE",
        subtitle: "Frozen anchors · arbitration · external truth",
        tone: "governance",
      },
      style: { width: 390, height: 340 },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: -1,
    });
  }
  return zones;
}

function eventText(payload: RunEvent["payload"]): string | null {
  for (const key of ["text", "delta", "message", "summary", "error"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function latestStreamTextByNode(events: RunEvent[]): Map<string, string> {
  const chunks = new Map<string, string[]>();
  for (const event of events) {
    if (!event.nodeId) continue;
    if (
      event.type !== "agent.message.delta" &&
      event.type !== "agent.terminal.delta" &&
      event.type !== "agent.diff" &&
      event.type !== "run.failed"
    ) {
      continue;
    }
    const text = eventText(event.payload);
    if (!text) continue;
    const bucket = chunks.get(event.nodeId) ?? [];
    bucket.push(text);
    while (bucket.join("\n").length > 280) {
      bucket.shift();
    }
    chunks.set(event.nodeId, bucket);
  }
  return new Map(
    [...chunks.entries()].map(function joinChunks([nodeId, lines]) {
      return [nodeId, lines.slice(-4).join("\n")] as const;
    }),
  );
}

type GraphModelOptions = {
  spec: GraphSpec;
  graphId: string | null;
  mode: AppMode;
  selected: string;
  searchQuery: string;
  events: RunEvent[];
  statuses: Record<string, string>;
  validation: ValidationResult;
};

export type DashboardGraphModel = {
  active: GraphNode | undefined;
  agentOptions: string[];
  searchResults: GraphNode[];
  flowNodes: Node<CardData>[];
  flowZones: Node<LoopZoneData>[];
  flowEdges: Edge[];
  nodeEvents: RunEvent[];
  errorCount: number;
  flowKey: string;
  nodeTypes: NodeTypes;
};

export function useDashboardGraphModel(
  options: GraphModelOptions,
): DashboardGraphModel {
  const {
    spec,
    graphId,
    mode,
    selected,
    searchQuery,
    events,
    statuses,
    validation,
  } = options;

  return useMemo(
    function deriveDashboardGraphModel(): DashboardGraphModel {
      const active =
        spec.nodes.find(function isSelectedNode(node) {
          return node.id === selected;
        }) ?? spec.nodes[0];
      const agentOptions = [
        "Auto",
        ...new Set(
          spec.nodes.flatMap(function getPreferredAgents(node) {
            return node.agentSelector.preferredAgents;
          }),
        ),
      ];
      const normalizedQuery = searchQuery.trim().toLowerCase();
      const searchResults = spec.nodes.filter(function matchesSearch(node) {
        return `${node.title} ${node.id} ${node.kind} ${node.objective}`
          .toLowerCase()
          .includes(normalizedQuery);
      });
      const layout = layoutGraphNodes(spec.nodes, spec.edges);
      const flowZones = createLoopZones(spec);
      const relatedIds = new Set<string>([selected]);
      for (const edge of spec.edges) {
        if (edge.from === selected) relatedIds.add(edge.to);
        if (edge.to === selected) relatedIds.add(edge.from);
      }
      const streamByNode = latestStreamTextByNode(events);
      const flowNodes = spec.nodes.map(function createFlowNode(node) {
        const role = supervisionRoleForKind(node.kind);
        const status =
          statuses[node.id] ?? (mode === "review" ? "ready" : "pending");
        const streamText = streamByNode.get(node.id);
        const focused = Boolean(selected) && relatedIds.has(node.id);
        const dimmed = Boolean(selected) && !focused;
        return {
          id: node.id,
          type: "graphCard",
          position: layout[node.id] ?? { x: 0, y: 0 },
          selected: node.id === selected,
          ...(dimmed
            ? { style: { opacity: 0.52, filter: "grayscale(0.2)" } }
            : {}),
          data: {
            title: node.title,
            subtitle: node.objective,
            kind: node.kind.toUpperCase(),
            role: supervisionRoleLabel(role),
            agent: node.agentSelector.preferredAgents[0] ?? "Auto",
            status,
            accent:
              status === "succeeded"
                ? "#58a338"
                : status === "running"
                  ? "#5b8cff"
                  : status === "failed"
                    ? "#d45b5b"
                    : reviewAccentForKind(node.kind),
            outputs: node.outputs.map(function getOutputName(output) {
              return output.name;
            }),
            ...(streamText ? { streamText } : {}),
          },
        };
      });
      const flowEdges = spec.edges.map(
        function createFlowEdge(edge, index): Edge {
          const artifactsReady = edge.artifacts.every(
            function artifactWasCreated(name) {
              return events.some(function isCreatedArtifact(event) {
                return (
                  event.type === "artifact.created" &&
                  event.payload.name === name
                );
              });
            },
          );
          const sourceStatus = statuses[edge.from] ?? "";
          const targetStatus = statuses[edge.to] ?? "";
          const onFocusPath =
            Boolean(selected) &&
            (edge.from === selected || edge.to === selected);
          const flowing =
            artifactsReady ||
            sourceStatus === "running" ||
            onFocusPath ||
            (sourceStatus === "succeeded" &&
              (targetStatus === "running" ||
                targetStatus === "ready" ||
                targetStatus === "pending"));
          const dimmed =
            Boolean(selected) && edge.from !== selected && edge.to !== selected;
          return {
            id: `e${index}`,
            source: edge.from,
            target: edge.to,
            label: edge.artifacts.join(" + "),
            animated: flowing,
            className: flowing ? "edge-flowing" : "edge-idle",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: flowing ? "#7ea2ff" : "#4c68e8",
            },
            style: {
              stroke: flowing ? "#7ea2ff" : "#3f59d2",
              strokeWidth: flowing || onFocusPath ? 2.4 : 1.5,
              opacity: dimmed ? 0.18 : 1,
            },
            labelStyle: { fill: "#a9b4e9", fontSize: 10, fontWeight: 600 },
            labelBgStyle: { fill: "#101218", fillOpacity: 0.95 },
            labelBgPadding: [7, 4] as [number, number],
          };
        },
      );
      const nodeEvents = active
        ? events.filter(function belongsToActiveNode(event) {
            return event.nodeId === active.id;
          })
        : [];

      return {
        active,
        agentOptions,
        searchResults,
        flowNodes,
        flowZones,
        flowEdges,
        nodeEvents,
        errorCount: validation.issues.filter(function isValidationError(issue) {
          return issue.severity === "error";
        }).length,
        flowKey: `${graphId ?? "local"}:${spec.nodes
          .map(function getNodeId(node) {
            return node.id;
          })
          .join("|")}`,
        nodeTypes: dashboardNodeTypes,
      };
    },
    [
      events,
      graphId,
      mode,
      searchQuery,
      selected,
      spec,
      statuses,
      validation.issues,
    ],
  );
}
