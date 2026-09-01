import { createApiClient } from "../../api-client/src/index.ts";
import { ensureDaemon, getGraphdBaseUrl, getSessionToken } from "./daemon-lifecycle.ts";

const graphd = createApiClient({
  baseUrl: getGraphdBaseUrl(),
  token: getSessionToken,
  formatHttpError: formatGraphdHttpError,
});

export async function callGraphd<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  await ensureDaemon();
  try {
    return await graphd.request<T>(path, init);
  } catch (error) {
    if (!isUnreachableGraphdError(error)) {
      throw error;
    }
    await ensureDaemon({ forceRestart: true });
    return graphd.request<T>(path, init);
  }
}

function formatGraphdHttpError(status: number, body: string): string {
  return `graphd ${status}: ${body}`;
}

export function isUnreachableGraphdError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const parts = [error.name, error.message];
  if (error.cause instanceof Error) {
    parts.push(error.cause.name, error.cause.message);
  } else if (error.cause != null) {
    parts.push(String(error.cause));
  }

  const text = parts.join(" ").toLowerCase();
  return (
    text.includes("fetch failed") ||
    text.includes("econnrefused") ||
    text.includes("econnreset") ||
    text.includes("enetunreach") ||
    text.includes("enotfound") ||
    text.includes("socket hang up") ||
    text.includes("network") ||
    text.includes("aborted") ||
    text.includes("timeout")
  );
}
