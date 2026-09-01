import { Bot, CircleDot, Clock3 } from "lucide-react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { CardData, GraphEdge, GraphPosition } from "./types.ts";

export function GraphCard({
  data,
  selected,
}: NodeProps<import("@xyflow/react").Node<CardData>>) {
  return (
    <div
      className={`node-card ${selected ? "selected" : ""} state-${data.status}`}
      style={{ "--accent": data.accent } as CSSProperties}
    >
      <Handle type="target" position={Position.Left} className="port" />
      <div className="node-top">
        <span className="node-kind">
          <CircleDot size={11} />
          {data.kind}
        </span>
        <span className={`node-role role-${data.role.toLowerCase()}`}>
          {data.role}
        </span>
        <span className={`status-dot ${data.status}`} />
      </div>
      <h3>{data.title}</h3>
      <p>{data.subtitle}</p>
      <div className="node-agent">
        <Bot size={13} />
        <span>{data.agent}</span>
        <span className="node-time">
          <Clock3 size={11} />
          {data.status === "running" ? "live" : "~2m"}
        </span>
      </div>
      <div className="outputs">
        {data.outputs.map(function renderOutput(output) {
          return <span key={output}>{output}</span>;
        })}
      </div>
      <Handle type="source" position={Position.Right} className="port" />
    </div>
  );
}

export function layoutGraphNodes<NodeLike extends { id: string }>(
  nodes: NodeLike[],
  edges: GraphEdge[],
): Record<string, GraphPosition> {
  const nodeIds = new Set(
    nodes.map(function getNodeId(node) {
      return node.id;
    }),
  );
  const indegree = new Map<string, number>(
    nodes.map(function initializeIndegree(node) {
      return [node.id, 0];
    }),
  );
  const depth = new Map<string, number>(
    nodes.map(function initializeDepth(node) {
      return [node.id, 0];
    }),
  );
  const successors = new Map(
    nodes.map(function initializeSuccessors(node) {
      return [node.id, [] as string[]] as const;
    }),
  );

  for (const edge of edges) {
    if (
      !nodeIds.has(edge.from) ||
      !nodeIds.has(edge.to) ||
      edge.from === edge.to
    )
      continue;
    successors.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const queue = nodes
    .filter(function isRootNode(node) {
      return indegree.get(node.id) === 0;
    })
    .map(function getRootId(node) {
      return node.id;
    });

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor];
    if (!source) continue;
    for (const target of successors.get(source) ?? []) {
      depth.set(
        target,
        Math.max(depth.get(target) ?? 0, (depth.get(source) ?? 0) + 1),
      );
      const remaining = (indegree.get(target) ?? 1) - 1;
      indegree.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }

  const layers = new Map<number, NodeLike[]>();
  for (const node of nodes) {
    const layer = depth.get(node.id) ?? 0;
    layers.set(layer, [...(layers.get(layer) ?? []), node]);
  }

  const maxRows = Math.max(
    1,
    ...[...layers.values()].map(function getLayerSize(layer) {
      return layer.length;
    }),
  );
  const positions: Record<string, GraphPosition> = {};
  for (const [layer, layerNodes] of layers) {
    const verticalOffset = (maxRows - layerNodes.length) * 145;
    layerNodes.forEach(function positionNode(node, row) {
      positions[node.id] = {
        x: 40 + layer * 340,
        y: 170 + verticalOffset + row * 290,
      };
    });
  }
  return positions;
}
