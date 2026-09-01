import type { FastifyInstance } from "fastify";
import type { DaemonContext, IdParams } from "./types.ts";

type CommentBody = {
  nodeId?: string;
  body?: string;
  role?: "user" | "system";
};

type CommentQuery = {
  nodeId?: string;
};

export function registerCommentRoutes(
  app: FastifyInstance,
  context: DaemonContext,
): void {
  app.get<{ Params: IdParams; Querystring: CommentQuery }>(
    "/api/graphs/:id/comments",
    async function listComments(request) {
      const graph = context.store.getGraph(request.params.id);
      if (!graph) {
        return { error: "NOT_FOUND" };
      }
      return {
        comments: context.store.listNodeComments(
          request.params.id,
          request.query.nodeId,
        ),
      };
    },
  );

  app.post<{ Params: IdParams; Body: CommentBody }>(
    "/api/graphs/:id/comments",
    async function createComment(request, reply) {
      const graph = context.store.getGraph(request.params.id);
      if (!graph) {
        return { error: "NOT_FOUND" };
      }

      const nodeId = request.body.nodeId?.trim();
      const body = request.body.body?.trim();
      if (!nodeId || !body) {
        return reply.code(400).send({ error: "INVALID_COMMENT" });
      }

      const knownNode = graph.spec.nodes.some(function matchesNode(node) {
        return node.id === nodeId;
      });
      if (!knownNode) {
        return reply.code(400).send({ error: "UNKNOWN_NODE" });
      }

      const comment = context.store.addNodeComment(
        request.params.id,
        nodeId,
        body,
        request.body.role === "system" ? "system" : "user",
      );
      return { comment };
    },
  );
}
