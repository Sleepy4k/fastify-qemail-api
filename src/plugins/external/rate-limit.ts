import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { env } from "../../config/env.ts";

export default fp(
  async function rateLimitPlugin(app: FastifyInstance) {
    await app.register(rateLimit, {
      global: false,
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW,
      allowList: ["127.0.0.1", "::1"],
      keyGenerator: (req) => {
        return (
          req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ??
          req.ip
        );
      },
    });
  },
  { name: "rate-limit", dependencies: ["redis"] },
);
