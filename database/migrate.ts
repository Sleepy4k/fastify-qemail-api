import { createConnection } from "mysql2/promise";
import { readdir, readFile } from "fs/promises";
import { join, resolve } from "path";

const MIGRATIONS_DIR = resolve(import.meta.dir, "migrations");
const FRESH = process.argv.includes("--fresh");

const DB_HOST = process.env["DB_HOST"] ?? "localhost";
const DB_PORT = Number(process.env["DB_PORT"] ?? 3306);
const DB_USER = process.env["DB_USER"] ?? "root";
const DB_PASSWORD = process.env["DB_PASSWORD"] ?? "";
const DB_NAME = process.env["DB_NAME"] ?? "qemail_db";

async function dropAll(conn: Awaited<ReturnType<typeof createConnection>>) {
  const [tables] = await conn.query<import("mysql2").RowDataPacket[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
    [DB_NAME],
  );

  if (tables.length === 0) {
    console.log("[migrate:fresh] No tables to drop.");
    return;
  }

  await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
  for (const row of tables) {
    const name = row["TABLE_NAME"] as string;
    await conn.execute(`DROP TABLE IF EXISTS \`${name}\``);
    console.log(`[migrate:fresh]   dropped \`${name}\``);
  }
  await conn.execute("SET FOREIGN_KEY_CHECKS = 1");
  console.log("[migrate:fresh] All tables dropped.");
}

async function run() {
  const conn = await createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
    timezone: "+00:00",
  });

  console.log(`[migrate] Connected to ${DB_HOST}:${DB_PORT}/${DB_NAME}`);

  if (FRESH) {
    console.log("[migrate] --fresh flag detected: dropping all tables …");
    await dropAll(conn);
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id        INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
      name      VARCHAR(255)     NOT NULL UNIQUE,
      run_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [rows] = await conn.execute<import("mysql2").RowDataPacket[]>(
    "SELECT name FROM migrations ORDER BY id ASC",
  );
  const applied = new Set(rows.map((r) => r["name"] as string));

  const allFiles = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = allFiles.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("[migrate] Nothing to migrate — all migrations are up to date.");
    await conn.end();
    process.exit(0);
  }

  console.log(`[migrate] ${pending.length} pending migration(s):`);

  for (const file of pending) {
    const filepath = join(MIGRATIONS_DIR, file);
    const sql = await readFile(filepath, "utf-8");

    console.log(`[migrate]   → Running ${file} …`);

    try {
      await conn.beginTransaction();
      await conn.query(sql);
      await conn.execute("INSERT INTO migrations (name) VALUES (?)", [file]);
      await conn.commit();
      console.log(`[migrate]   ✓ ${file}`);
    } catch (err) {
      await conn.rollback();
      console.error(`[migrate]   ✗ ${file} failed:`);
      console.error(err);
      await conn.end();
      process.exit(1);
    }
  }

  console.log("[migrate] All migrations applied successfully.");
  await conn.end();
}

run().catch((err) => {
  console.error("[migrate] Fatal error:", err);
  process.exit(1);
});
