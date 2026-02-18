import { createConnection } from "mysql2/promise";
import { readdir, readFile } from "fs/promises";
import { join, resolve } from "path";
import { env } from "../src/config/env";

const SEEDS_DIR = resolve(import.meta.dir, "seeds");
const FRESH = process.argv.includes("--fresh");

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

  console.log(`[seed] Connected to ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);

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

  const [rows] = await conn.execute<{ name: string }[] & import("mysql2").RowDataPacket[]>(
    "SELECT name FROM seed_runs ORDER BY id ASC"
  );
  const applied = new Set(rows.map((r) => r.name));

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
