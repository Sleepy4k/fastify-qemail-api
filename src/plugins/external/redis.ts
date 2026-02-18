import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { createClient } from "redis";
import { env } from "../../config/env.ts";

export default fp(
  async function redisPlugin(app: FastifyInstance) {
    const client = createClient({
      socket: { host: env.REDIS_HOST, port: env.REDIS_PORT },
      username: env.REDIS_USERNAME || undefined,
      password: env.REDIS_PASSWORD || undefined,
      database: env.REDIS_DB,
    });

    client.on("error", (err: any) => app.log.error(err, "Redis error"));

    await client.connect();

    const redisWithPrefix = {
      client,

      key: (key: string) => `${env.REDIS_PREFIX}${key}`,

      get: async (key: string) => {
        return client.get(`${env.REDIS_PREFIX}${key}`);
      },

      set: async (key: string, value: string) => {
        return client.set(`${env.REDIS_PREFIX}${key}`, value);
      },

      setEx: async (key: string, seconds: number, value: string) => {
        return client.setEx(`${env.REDIS_PREFIX}${key}`, seconds, value);
      },

      del: async (key: string) => {
        return client.del(`${env.REDIS_PREFIX}${key}`);
      },

      exists: async (key: string) => {
        return client.exists(`${env.REDIS_PREFIX}${key}`);
      },

      expire: async (key: string, seconds: number) => {
        return client.expire(`${env.REDIS_PREFIX}${key}`, seconds);
      },

      ttl: async (key: string) => {
        return client.ttl(`${env.REDIS_PREFIX}${key}`);
      },
    };

    app.decorate("redis", redisWithPrefix);

    app.addHook("onClose", async () => {
      await client.quit();
      app.log.info("Redis disconnected");
    });
  },
  { name: "redis" },
);
