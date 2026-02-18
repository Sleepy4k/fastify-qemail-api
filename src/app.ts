import Fastify from "fastify";
import { env } from "./config/env.ts";

import mysqlPlugin from "./plugins/external/mysql.ts";
import redisPlugin from "./plugins/external/redis.ts";
import corsPlugin from "./plugins/external/cors.ts";
import helmetPlugin from "./plugins/external/helmet.ts";
import jwtPlugin from "./plugins/external/jwt.ts";
import rateLimitPlugin from "./plugins/external/rate-limit.ts";
import swaggerPlugin from "./plugins/external/swagger.ts";

import errorHandler from "./plugins/internal/error-handler.ts";

import { emailRoutes } from "./modules/email/email.routes.ts";
import { webhookRoutes } from "./modules/webhook/webhook.routes.ts";
import { adminRoutes } from "./modules/admin/admin.routes.ts";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        env.NODE_ENV === "production"
          ? undefined
          : {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
              },
            },
    },
    trustProxy: true,
    requestIdHeader: "x-request-id",
  });

  await app.register(mysqlPlugin);
  await app.register(redisPlugin);
  await app.register(corsPlugin);
  await app.register(helmetPlugin);
  await app.register(jwtPlugin);
  await app.register(rateLimitPlugin);
  await app.register(swaggerPlugin);
  await app.register(errorHandler);

  app.get("/health", async () => {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  await app.register(emailRoutes, { prefix: "/api/v1/email" });
  await app.register(webhookRoutes, { prefix: "/api/v1/webhook" });
  await app.register(adminRoutes, { prefix: "/api/v1/admin" });

  return app;
}

