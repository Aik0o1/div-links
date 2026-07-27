import { pool } from "./db/pool.js";
import { redisConnection } from "./config/redis.js";
import { logger } from "./config/logger.js";

async function main() {
  await pool.query("SELECT 1");
  logger.info("conexão com Postgres OK");

  await redisConnection.ping();
  logger.info("conexão com Redis OK");

  logger.info("fundação do sistema pronta");
  await pool.end();
  redisConnection.disconnect();
}

main().catch((err) => {
  logger.error({ err }, "falha ao iniciar");
  process.exit(1);
});
