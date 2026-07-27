import { buildAuthorizationUrl, autorizarComCodigo } from "./auth.js";
import { pool } from "../../db/pool.js";
import { logger } from "../../config/logger.js";

function extrairCode(entrada: string): string {
  const texto = entrada.trim();
  if (texto.startsWith("http")) {
    const url = new URL(texto);
    const code = url.searchParams.get("code");
    if (!code) {
      throw new Error("Não encontrei o parâmetro ?code= na URL colada.");
    }
    return code;
  }
  return texto;
}

async function main() {
  const argumento = process.argv[2];

  if (!argumento) {
    const { url, state } = buildAuthorizationUrl();

    console.log("\n1. Abra esta URL no navegador e faça login/autorize:\n");
    console.log(`   ${url}\n`);
    console.log(`   (state gerado para esta tentativa: ${state})\n`);
    console.log(
      "2. Após autorizar, o navegador vai tentar redirecionar para o seu redirect_uri",
    );
    console.log("   (ou aparecer na página do webhook.site).\n");
    console.log(
      "3. Rode de novo passando a URL de redirecionamento (ou só o code) como argumento:\n",
    );
    console.log('   npm run meli:autorizar -- "<url-ou-code>"\n');
    return;
  }

  const code = extrairCode(argumento);
  await autorizarComCodigo(code);

  logger.info("tokens do Mercado Livre salvos com sucesso");
  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, "falha na autorização do Mercado Livre");
  process.exit(1);
});
