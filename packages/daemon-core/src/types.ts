import type { FastifyInstance } from "fastify";
import type { EventStore } from "../../event-store/src/index.ts";
import type { GraphRuntime } from "../../graph-runtime/src/index.ts";

export type DaemonOptions = {
  port?: number;
  host?: string;
  dataDir?: string;
  webDist?: string;
};

export interface DaemonContext {
  host: string;
  port: number;
  projectRoot: string;
  token: string;
  store: EventStore;
  runtime: GraphRuntime;
}

export interface DaemonHandle {
  app: FastifyInstance;
  store: EventStore;
  runtime: GraphRuntime;
  token: string;
  url: string;
}

export interface IdParams {
  id: string;
}

export interface NodeParams extends IdParams {
  node: string;
}

export interface TokenQuery {
  token?: string;
}

export interface EventsQuery {
  after?: number | string;
}

export interface WebSocketQuery {
  since?: number | string;
  token?: string;
}

export interface RepositoryQuery {
  root?: string;
}

export interface PublishGraphBody {
  spec: unknown;
  projectId?: string;
}

export interface GraphSpecBody {
  spec: unknown;
}

export interface ReassignBody {
  agent: string;
}
