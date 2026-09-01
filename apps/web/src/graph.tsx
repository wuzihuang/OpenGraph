import { Bot, CircleDot, Clock3 } from "lucide-react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { CardData, GraphEdge, GraphPosition } from "./types.ts";

export type LoopZoneData = {
  label: string;
  subtitle: string;
  tone: "fast" | "medium" | "strategic" | "governance";
};

export function LoopZone({
  data,
}: NodeProps<import("@xyflow/react").Node<LoopZoneData>>) {
  return (
    <section className={`loop-zone loop-zone-${data.tone}`}>
      <span>{data.label}</span>
      <p>{data.subtitle}</p>
    </section>
  );
}

export function GraphCard({
  data,
  selected,
}: NodeProps<import("@xyflow/react").Node<CardData>>) {
  const stream = data.streamText?.trim();
  return (
    <div
      className={`node-card ${selected ? "selected" : ""} state-${data.status}`}
      style={{ "--accent": data.accent } as CSSProperties}
    >
      <Handle type="target" position={Position.Top} className="port" />
      <Handle
        type="target"
        position={Position.Left}
        id="left-in"
        className="port"
      />
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
      {stream ? (
        <pre className="node-stream" title={stream}>
          {stream}
        </pre>
      ) : null}
      <div className="node-agent">
        <Bot size={13} />
        <span>{data.agent}</span>
        <span className="node-time">
          <Clock3 size={11} />
          {data.status === "running" ? "live" : data.status}
        </span>
      </div>
      <div className="outputs">
        {data.outputs.slice(0, 3).map(function renderOutput(output) {
          return <span key={output}>{output}</span>;
        })}
        {data.outputs.length > 3 ? (
          <span className="outputs-more">+{data.outputs.length - 3}</span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="port" />
      <Handle
        type="source"
        position={Position.Right}
        id="right-out"
        className="port"
      />
    </div>
  );
}

function buildGraphLayers<NodeLike extends { id: string }>(
  nodes: NodeLike[],
  edges: GraphEdge[],
): { depth: Map<string, number>; layers: Map<number, NodeLike[]> } {
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
    ) {
      continue;
    }
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

  return { depth, layers };
}

type LoopBand = "fast" | "medium" | "strategic" | "governance" | "other";

function canReachAny(
  startId: string,
  targets: Set<string>,
  successors: Map<string, string[]>,
): boolean {
  const queue = [...(successors.get(startId) ?? [])];
  const seen = new Set<string>([startId]);
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || seen.has(next)) continue;
    if (targets.has(next)) return true;
    seen.add(next);
    queue.push(...(successors.get(next) ?? []));
  }
  return false;
}

function inferLoopBands<NodeLike extends { id: string; kind?: string }>(
  nodes: NodeLike[],
  edges: GraphEdge[],
): Map<string, LoopBand> {
  const successors = new Map(
    nodes.map(function initializeSuccessors(node) {
      return [node.id, [] as string[]] as const;
    }),
  );
  for (const edge of edges) {
    successors.get(edge.from)?.push(edge.to);
  }

  const fastSeeds = new Set(
    nodes
      .filter(function isFastNode(node) {
        return /(^|_)fast(_|$)|loop[_-]?1/i.test(node.id);
      })
      .map(function getId(node) {
        return node.id;
      }),
  );
  const mediumSeeds = new Set(
    nodes
      .filter(function isMediumNode(node) {
        return /(^|_)(mid|medium)(_|$)|loop[_-]?2/i.test(node.id);
      })
      .map(function getId(node) {
        return node.id;
      }),
  );
  const bands = new Map<string, LoopBand>();

  for (const node of nodes) {
    if (
      /(^|_)(guard|governance|arbiter|integrity|anchor)(_|$)/i.test(node.id)
    ) {
      bands.set(node.id, "governance");
    } else if (
      /(^|_)(strat|strategic)(_|$)|loop[_-]?3/i.test(node.id) ||
      node.kind === "human" ||
      node.kind === "acceptance"
    ) {
      bands.set(node.id, "strategic");
    } else if (mediumSeeds.has(node.id)) {
      bands.set(node.id, "medium");
    } else if (
      fastSeeds.has(node.id) ||
      canReachAny(node.id, fastSeeds, successors)
    ) {
      bands.set(node.id, "fast");
    } else if (canReachAny(node.id, mediumSeeds, successors)) {
      bands.set(node.id, "medium");
    } else {
      bands.set(node.id, "other");
    }
  }
  return bands;
}

function positionLoopCluster<NodeLike extends { id: string }>(
  nodes: NodeLike[],
  center: GraphPosition,
  positions: Record<string, GraphPosition>,
): void {
  if (nodes.length === 0) return;
  if (nodes.length === 1) {
    positions[nodes[0]!.id] = center;
    return;
  }

  const radiusX = nodes.length > 4 ? 230 : 200;
  const radiusY = nodes.length > 4 ? 145 : 135;
  nodes.forEach(function positionAroundLoop(node, index) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / nodes.length;
    positions[node.id] = {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
    };
  });
}

function layoutMultiLoopGraph<NodeLike extends { id: string; kind?: string }>(
  nodes: NodeLike[],
  edges: GraphEdge[],
): Record<string, GraphPosition> | null {
  const bands = inferLoopBands(nodes, edges);
  const grouped = new Map<LoopBand, NodeLike[]>();
  for (const node of nodes) {
    const band = bands.get(node.id) ?? "other";
    grouped.set(band, [...(grouped.get(band) ?? []), node]);
  }

  const recognizedCount =
    (grouped.get("fast")?.length ?? 0) +
    (grouped.get("medium")?.length ?? 0) +
    (grouped.get("strategic")?.length ?? 0) +
    (grouped.get("governance")?.length ?? 0);
  if (recognizedCount < Math.min(3, nodes.length)) return null;

  const positions: Record<string, GraphPosition> = {};
  positionLoopCluster(grouped.get("fast") ?? [], { x: 650, y: 210 }, positions);
  positionLoopCluster(
    grouped.get("medium") ?? [],
    { x: 230, y: 660 },
    positions,
  );
  positionLoopCluster(
    grouped.get("strategic") ?? [],
    { x: 1070, y: 660 },
    positions,
  );
  positionLoopCluster(
    grouped.get("governance") ?? [],
    { x: 650, y: 660 },
    positions,
  );
  positionLoopCluster(
    grouped.get("other") ?? [],
    { x: 650, y: 1080 },
    positions,
  );
  return positions;
}

export function layoutGraphNodes<NodeLike extends { id: string }>(
  nodes: NodeLike[],
  edges: GraphEdge[],
): Record<string, GraphPosition> {
  const multiLoop = layoutMultiLoopGraph(nodes, edges);
  if (multiLoop) return multiLoop;

  const { layers } = buildGraphLayers(nodes, edges);
  const maxLayer = Math.max(0, ...[...layers.keys()]);
  const maxWidth = Math.max(
    1,
    ...[...layers.values()].map(function getLayerSize(layer) {
      return layer.length;
    }),
  );

  const horizontalSpacing = 300;
  const verticalSpacing = 270;
  const centerX = 120 + (maxWidth * horizontalSpacing) / 2;
  const positions: Record<string, GraphPosition> = {};

  for (const [layer, layerNodes] of layers) {
    const count = layerNodes.length;
    const rowWidth = (count - 1) * horizontalSpacing;
    const layerProgress = maxLayer > 0 ? layer / maxLayer : 0;
    const diamondWave = Math.sin(layerProgress * Math.PI) * 52;

    layerNodes.forEach(function positionNode(node, index) {
      const stagger = index % 2 === 0 ? 0 : 24;
      positions[node.id] = {
        x:
          centerX -
          rowWidth / 2 +
          index * horizontalSpacing +
          diamondWave +
          stagger,
        y: 60 + layer * verticalSpacing,
      };
    });
  }

  return positions;
}
