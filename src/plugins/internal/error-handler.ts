import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

export default fp(
  async function errorHandler(app: FastifyInstance) {
    app.setErrorHandler(
      (error: Error & { statusCode?: number }, request, reply) => {
        const statusCode = error.statusCode ?? 500;

        request.log.error({ err: error }, error.message);

        reply.status(statusCode).send({
          statusCode,
          error: error.name ?? "Error",
          message: statusCode >= 500 ? "Internal Server Error" : error.message,
        });
      },
    );

    app.setNotFoundHandler((_request, reply) => {
      reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Route not found",
      });
    });
  },
  { name: "error-handler" },
);
