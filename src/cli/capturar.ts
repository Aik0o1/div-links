import { capturarProdutos } from "../servicos/capturarProdutos.js";
import { pool } from "../db/pool.js";
import { logger } from "../config/logger.js";

capturarProdutos()
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
