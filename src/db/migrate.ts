import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";
import { logger } from "../config/logger.js";

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      aplicada_em TIMESTAMP DEFAULT now()
    );
  `);

  const { rows } = await pool.query<{ name: string }>(
    "SELECT name FROM schema_migrations",
  );
  const aplicadas = new Set(rows.map((r) => r.name));

  const arquivos = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue;

    const sql = await readFile(path.join(migrationsDir, arquivo), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        arquivo,
      ]);
      await client.query("COMMIT");
      logger.info({ arquivo }, "migration aplicada");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

migrate().catch((err) => {
  logger.error({ err }, "falha ao rodar migrations");
  process.exit(1);
});
