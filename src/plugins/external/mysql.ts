import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import mysql from "mysql2/promise";
import { env } from "../../config/env.ts";

export default fp(
  async function mysqlPlugin(app: FastifyInstance) {
    const pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      connectionLimit: env.DB_CONNECTION_LIMIT,
      waitForConnections: true,
      timezone: "+00:00",
    });

    const conn = await pool.getConnection();
    conn.release();
    app.log.info("MySQL connected");

    app.decorate("db", pool);
    app.addHook("onClose", async () => {
      await pool.end();
      app.log.info("MySQL disconnected");
    });
  },
  { name: "mysql" },
);
