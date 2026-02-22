import { createConnection } from "mysql2/promise";
import { readdir, readFile } from "fs/promises";
import { join, resolve } from "path";

const SEEDS_DIR = resolve(import.meta.dir, "seeds");
const FRESH = process.argv.includes("--fresh");

const DB_HOST = process.env["DB_HOST"] ?? "localhost";
const DB_PORT = Number(process.env["DB_PORT"] ?? 3306);
const DB_USER = process.env["DB_USER"] ?? "root";
const DB_PASSWORD = process.env["DB_PASSWORD"] ?? "";
const DB_NAME = process.env["DB_NAME"] ?? "qemail_db";

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

  console.log(`[seed] Connected to ${DB_HOST}:${DB_PORT}/${DB_NAME}`);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS seed_runs (
      id        INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
      name      VARCHAR(255)     NOT NULL UNIQUE,
      run_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  if (FRESH) {
    console.log("[seed] --fresh flag detected: clearing seed history …");
    await conn.execute("TRUNCATE TABLE seed_runs");
  }

  const [rows] = await conn.execute<import("mysql2").RowDataPacket[]>(
    "SELECT name FROM seed_runs ORDER BY id ASC",
  );
  const applied = new Set(rows.map((r) => r["name"] as string));

  const allFiles = (await readdir(SEEDS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = allFiles.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("[seed] Nothing to seed — all seed files have already been applied.");
    console.log("[seed] Tip: use --fresh to force a full re-run.");
    await conn.end();
    process.exit(0);
  }

  console.log(`[seed] ${pending.length} pending seed file(s):`);

  for (const file of pending) {
    const filepath = join(SEEDS_DIR, file);
    const sql = await readFile(filepath, "utf-8");

    console.log(`[seed]   → Running ${file} …`);

    try {
      await conn.beginTransaction();
      await conn.query(sql);
      await conn.execute("INSERT INTO seed_runs (name) VALUES (?)", [file]);
      await conn.commit();
      console.log(`[seed]   ✓ ${file}`);
    } catch (err) {
      await conn.rollback();
      console.error(`[seed]   ✗ ${file} failed:`);
      console.error(err);
      await conn.end();
      process.exit(1);
    }
  }

  console.log("[seed] All seeds applied successfully.");
  await conn.end();
}

run().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});

