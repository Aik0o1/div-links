import { capturarProdutos } from "../servicos/capturarProdutos.js";
import { pool } from "../db/pool.js";
import { logger } from "../config/logger.js";

// CLI de uso manual (npm run capturar) — multi-tenant desde a Fase 4:
// precisa saber de qual tenant capturar. `npm run capturar -- 2` (id do
// usuário) ou `CAPTURAR_USUARIO_ID=2 npm run capturar`.
const usuarioIdArg = process.argv[2] ?? process.env.CAPTURAR_USUARIO_ID;
const usuarioId = Number(usuarioIdArg);
if (!usuarioIdArg || !Number.isInteger(usuarioId) || usuarioId <= 0) {
  console.error("Uso: npm run capturar -- <usuarioId>  (ou CAPTURAR_USUARIO_ID=<id> npm run capturar)");
  process.exit(1);
}

capturarProdutos(usuarioId)
  .then(async (resultado) => {
    console.log(
      `Captura concluída: ${resultado.novos} novo(s), ${resultado.duplicados} já existente(s).`,
    );
    await pool.end();
  })
  .catch((err) => {
    logger.error({ err }, "falha na captura");
    process.exit(1);
  });
