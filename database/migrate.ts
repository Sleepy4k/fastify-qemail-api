import { createConnection } from "mysql2/promise";
import { readdir, readFile } from "fs/promises";
import { join, resolve } from "path";
import { env } from "../src/config/env";

const MIGRATIONS_DIR = resolve(import.meta.dir, "migrations");

async function run() {
  const conn = await createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    multipleStatements: true,
    timezone: "+00:00",
  });

  console.log(`[migrate] Connected to ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id        INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
      name      VARCHAR(255)     NOT NULL UNIQUE,
      run_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [rows] = await conn.execute<{ name: string }[] & import("mysql2").RowDataPacket[]>(
    "SELECT name FROM migrations ORDER BY id ASC"
  );
  const applied = new Set(rows.map((r) => r.name));

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
