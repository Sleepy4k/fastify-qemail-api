import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import mysql from "mysql2/promise";

export default fp(
  async function mysqlPlugin(app: FastifyInstance) {
    const pool = mysql.createPool({
      host: app.config.DB_HOST,
      port: app.config.DB_PORT,
      user: app.config.DB_USER,
      password: app.config.DB_PASSWORD,
      database: app.config.DB_NAME,
      connectionLimit: app.config.DB_CONNECTION_LIMIT,
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
  { name: "mysql", dependencies: ["env"] },
);
