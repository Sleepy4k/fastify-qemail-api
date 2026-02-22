import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

export default fp(
  async function corsPlugin(app: FastifyInstance) {
    await app.register(cors, {
      origin: app.config.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
  },
  { name: "cors", dependencies: ["env"] },
);
