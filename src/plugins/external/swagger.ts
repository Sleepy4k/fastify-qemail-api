import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env } from "../../config/env.ts";

export default fp(
  async function swaggerPlugin(app: FastifyInstance) {
    if (!env.ENABLE_SWAGGER) return;

    await app.register(swagger, {
      openapi: {
        info: {
          title: "QEmail API",
          description: "Temporary email service API",
          version: "1.0.0",
        },
        tags: [
          { name: "email", description: "Email generation & inbox" },
          { name: "webhook", description: "Cloudflare webhook" },
          { name: "admin", description: "Admin dashboard" },
        ],
        components: {
          securitySchemes: {
            bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          },
        },
      },
    });

    await app.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: { docExpansion: "list", deepLinking: true },
    });
  },
  { name: "swagger" },
);
