import { createApiClient } from "../../api-client/src/index.ts";
import { getGraphdBaseUrl, getSessionToken } from "./daemon-lifecycle.ts";

const graphd = createApiClient({
  baseUrl: getGraphdBaseUrl(),
  token: getSessionToken,
  formatHttpError: formatGraphdHttpError,
});

export async function callGraphd<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return graphd.request<T>(path, init);
}

function formatGraphdHttpError(status: number, body: string): string {
  return `graphd ${status}: ${body}`;
}
