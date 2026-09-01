import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { useMemo } from "react";
import { supervisionRoleForKind } from "../../../packages/contracts/src/index.ts";
import { GraphCard, layoutGraphNodes } from "./graph.tsx";
import { reviewAccentForKind, supervisionRoleLabel } from "./node-roles.ts";
import type {
  AppMode,
  CardData,
  GraphNode,
  GraphSpec,
  RunEvent,
  ValidationResult,
} from "./types.ts";

const dashboardNodeTypes = { graphCard: GraphCard };

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
  flowEdges: Edge[];
  nodeEvents: RunEvent[];
  errorCount: number;
  flowKey: string;
  nodeTypes: { graphCard: typeof GraphCard };
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
      const flowNodes = spec.nodes.map(function createFlowNode(node) {
        const role = supervisionRoleForKind(node.kind);
        return {
          id: node.id,
          type: "graphCard",
          position: layout[node.id] ?? { x: 0, y: 0 },
          data: {
            title: node.title,
            subtitle: node.objective,
            kind: node.kind.toUpperCase(),
            role: supervisionRoleLabel(role),
            agent: node.agentSelector.preferredAgents[0] ?? "Auto",
            status:
              statuses[node.id] ?? (mode === "review" ? "ready" : "pending"),
            accent:
              statuses[node.id] === "succeeded"
                ? "#58a338"
                : reviewAccentForKind(node.kind),
            outputs: node.outputs.map(function getOutputName(output) {
              return output.name;
            }),
          },
        };
      });
      const flowEdges = spec.edges.map(
        function createFlowEdge(edge, index): Edge {
          return {
            id: `e${index}`,
            source: edge.from,
            target: edge.to,
            label: edge.artifacts.join(" + "),
            animated: edge.artifacts.every(function artifactWasCreated(name) {
              return events.some(function isCreatedArtifact(event) {
                return (
                  event.type === "artifact.created" &&
                  event.payload.name === name
                );
              });
            }),
            markerEnd: { type: MarkerType.ArrowClosed, color: "#4c68e8" },
            style: { stroke: "#3f59d2", strokeWidth: 1.5 },
            labelStyle: { fill: "#a9b4e9", fontSize: 10, fontWeight: 600 },
            labelBgStyle: { fill: "#101218", fillOpacity: 0.95 },
            labelBgPadding: [7, 4],
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
