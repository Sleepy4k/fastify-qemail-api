import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";

export default fp(
  async function helmetPlugin(app: FastifyInstance) {
    await app.register(helmet, {
      global: true,
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    });
  },
  { name: "helmet" },
);
