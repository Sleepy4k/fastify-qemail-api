import "fastify";
import type { Pool } from "mysql2/promise";
import type { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

interface RedisWithPrefix {
  client: RedisClient;
  key: (key: string) => string;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<string | null>;
  setEx: (
    key: string,
    seconds: number,
    value: string,
  ) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<boolean>;
  ttl: (key: string) => Promise<number>;
}

interface AppConfig {
  NODE_ENV: string;
  PORT: number;
  HOST: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_CONNECTION_LIMIT: number;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_USERNAME: string;
  REDIS_PASSWORD: string;
  REDIS_DB: number;
  REDIS_PREFIX: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  ADMIN_JWT_SECRET: string;
  ADMIN_JWT_EXPIRES_IN: string;
  SESSION_SECRET: string;
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  CF_WEBHOOK_SECRET: string;
  CF_WORKER_NAME: string;
  CORS_ORIGIN: string;
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_WINDOW: number;
  EMAIL_EXPIRY_HOURS: number;
  MAX_EMAILS_PER_IP: number;
  ENABLE_SWAGGER: boolean;
  UPLOAD_DIR: string;
  UPLOAD_BASE_URL: string;
}

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
    db: Pool;
    redis: RedisWithPrefix;
    verifyUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyAdmin: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }

  interface FastifyRequest {
    user?: { sub: number; email: string; type: "user" };
    admin?: { sub: number; username: string; role: string; type: "admin" };
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: number; type: string; [key: string]: unknown };
    user: { sub: number; type: string; [key: string]: unknown };
  }
}
