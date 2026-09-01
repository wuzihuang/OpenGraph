import type { FastifyInstance, FastifyRequest } from "fastify";

function tokenFromQuery(request: FastifyRequest): string | undefined {
  if (
    typeof request.query === "object" &&
    request.query !== null &&
    "token" in request.query
  ) {
    const token = request.query.token;
    return typeof token === "string" ? token : undefined;
  }

  return undefined;
}

export function registerAuth(app: FastifyInstance, token: string): void {
  app.addHook("onRequest", async function authenticateRequest(request, reply) {
    const isPublicRequest =
      request.url === "/api/health" ||
      (!request.url.startsWith("/api") && !request.url.startsWith("/ws"));

    if (isPublicRequest) {
      return;
    }

    const provided =
      request.headers.authorization?.replace(/^Bearer\s+/, "") ??
      tokenFromQuery(request);

    if (provided !== token) {
      return reply.code(401).send({ error: "UNAUTHORIZED" });
    }
  });
}
