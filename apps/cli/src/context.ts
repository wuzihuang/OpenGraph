import { join, resolve } from "node:path";
import {
  createApiClient,
  readTokenFile,
  type ApiClient,
} from "../../../packages/api-client/src/index.ts";

export interface CliContext {
  api: ApiClient;
  baseUrl: string;
  dataDir: string;
  token(): string;
}

export function createCliContext(): CliContext {
  const baseUrl = process.env.GRAPHD_URL ?? "http://127.0.0.1:4317";
  const dataDir = resolve(process.env.GRAPH_ENGINEER_HOME ?? ".graph-engineer");

  function token(): string {
    return readTokenFile(join(dataDir, "session-token"));
  }

  return {
    api: createApiClient({
      baseUrl,
      token,
      formatHttpError: formatCliHttpError,
    }),
    baseUrl,
    dataDir,
    token,
  };
}

function formatCliHttpError(status: number, body: string): string {
  return `${status} ${body}`;
}
