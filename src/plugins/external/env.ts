import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import fastifyEnv from "@fastify/env";

const envSchema = {
  type: "object",
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    PORT: { type: "integer", default: 3000 },
    HOST: { type: "string", default: "0.0.0.0" },

    DB_HOST: { type: "string", default: "localhost" },
    DB_PORT: { type: "integer", default: 3306 },
    DB_USER: { type: "string", default: "root" },
    DB_PASSWORD: { type: "string", default: "" },
    DB_NAME: { type: "string", default: "qemail_db" },
    DB_CONNECTION_LIMIT: { type: "integer", default: 10 },

    REDIS_HOST: { type: "string", default: "localhost" },
    REDIS_PORT: { type: "integer", default: 6379 },
    REDIS_USERNAME: { type: "string", default: "" },
    REDIS_PASSWORD: { type: "string", default: "" },
    REDIS_DB: { type: "integer", default: 0 },
    REDIS_PREFIX: { type: "string", default: "qemail:" },

    JWT_SECRET: { type: "string", default: "change-me-in-production" },
    JWT_EXPIRES_IN: { type: "string", default: "7d" },
    ADMIN_JWT_SECRET: { type: "string", default: "admin-change-me" },
    ADMIN_JWT_EXPIRES_IN: { type: "string", default: "1d" },
    SESSION_SECRET: { type: "string", default: "session-change-me" },

    CF_API_TOKEN: { type: "string", default: "" },
    CF_ACCOUNT_ID: { type: "string", default: "" },
    CF_WEBHOOK_SECRET: { type: "string", default: "" },
    CF_WORKER_NAME: { type: "string", default: "qemail-worker" },

    CORS_ORIGIN: { type: "string", default: "http://localhost:5173" },
    RATE_LIMIT_MAX: { type: "integer", default: 100 },
    RATE_LIMIT_WINDOW: { type: "integer", default: 900000 },

    EMAIL_EXPIRY_HOURS: { type: "integer", default: 24 },
    MAX_EMAILS_PER_IP: { type: "integer", default: 10 },

    ENABLE_SWAGGER: { type: "boolean", default: true },

    UPLOAD_DIR: { type: "string", default: "./uploads/attachments" },
    UPLOAD_BASE_URL: { type: "string", default: "http://localhost:3000" },
  },
};

export default fp(
  async function envPlugin(app: FastifyInstance) {
    await app.register(fastifyEnv, {
      schema: envSchema,
      confKey: "config",
      dotenv: false,
    });
  },
  { name: "env" },
);
