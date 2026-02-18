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

declare module "fastify" {
  interface FastifyInstance {
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
