import { existsSync, readFileSync } from "node:fs";

export type TokenProvider = () => string | Promise<string>;

export interface ApiClientOptions {
  baseUrl: string;
  token: TokenProvider;
  formatHttpError?: (status: number, body: string) => string;
  fetchImplementation?: typeof fetch;
}

export interface ApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

export class JsonResponseError extends Error {
  constructor(url: string, options?: ErrorOptions) {
    super(`Invalid JSON response from ${url}`, options);
    this.name = "JsonResponseError";
  }
}

export function readTokenFile(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8").trim() : "";
}

export async function createBearerHeaders(
  token: TokenProvider,
  init: RequestInit,
): Promise<Headers> {
  const headers = new Headers({
    authorization: `Bearer ${await token()}`,
  });

  new Headers(init.headers).forEach(function copyHeader(value, key) {
    headers.set(key, value);
  });

  if (init.body) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new JsonResponseError(response.url, { cause: error });
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  formatHttpError: (status: number, body: string) => string = defaultHttpError,
  fetchImplementation: typeof fetch = fetch,
): Promise<T> {
  const response = await fetchImplementation(url, init);
  if (!response.ok) {
    throw new Error(formatHttpError(response.status, await response.text()));
  }

  return parseJsonResponse<T>(response);
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const formatHttpError = options.formatHttpError ?? defaultHttpError;

  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const headers = await createBearerHeaders(options.token, init);
      return fetchJson<T>(
        `${options.baseUrl}${path}`,
        { ...init, headers },
        formatHttpError,
        fetchImplementation,
      );
    },
  };
}

function defaultHttpError(status: number, body: string): string {
  return `${status} ${body}`;
}
