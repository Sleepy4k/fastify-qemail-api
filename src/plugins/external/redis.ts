import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { createClient } from "redis";

export default fp(
  async function redisPlugin(app: FastifyInstance) {
    const prefix = app.config.REDIS_PREFIX;

    const client = createClient({
      socket: { host: app.config.REDIS_HOST, port: app.config.REDIS_PORT },
      username: app.config.REDIS_USERNAME || undefined,
      password: app.config.REDIS_PASSWORD || undefined,
      database: app.config.REDIS_DB,
    });

    client.on("error", (err: any) => app.log.error(err, "Redis error"));

    await client.connect();

    const redisWithPrefix = {
      client,

      key: (key: string) => `${prefix}${key}`,

      get: async (key: string) => {
        return client.get(`${prefix}${key}`);
      },

      set: async (key: string, value: string) => {
        return client.set(`${prefix}${key}`, value);
      },

      setEx: async (key: string, seconds: number, value: string) => {
        return client.setEx(`${prefix}${key}`, seconds, value);
      },

      del: async (key: string) => {
        return client.del(`${prefix}${key}`);
      },

      exists: async (key: string) => {
        return client.exists(`${prefix}${key}`);
      },

      expire: async (key: string, seconds: number) => {
        return client.expire(`${prefix}${key}`, seconds);
      },

      ttl: async (key: string) => {
        return client.ttl(`${prefix}${key}`);
      },
    };

    app.decorate("redis", redisWithPrefix);

    app.addHook("onClose", async () => {
      await client.quit();
      app.log.info("Redis disconnected");
    });
  },
  { name: "redis", dependencies: ["env"] },
);
