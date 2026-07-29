import { env } from "../../config/env.js";
import { obterShopeeConfig, type ShopeeConfig } from "../../repositorios/configuracoes.js";

/**
 * Credenciais efetivas da Shopee: banco (configurado pela UI) tem prioridade,
 * caindo pro .env se ainda não foi configurado por lá — mantém quem já tinha
 * SHOPEE_APP_ID/SHOPEE_SECRET no .env funcionando sem precisar repreencher.
 * Módulo isolado (em vez de morar em env.ts) pra evitar ciclo de import
 * env.ts -> configuracoes.ts -> pool.ts -> env.ts.
 */
export async function obterShopeeConfigEfetiva(): Promise<ShopeeConfig> {
  const doBanco = await obterShopeeConfig();
  if (doBanco?.appId && doBanco?.secret) return doBanco;

  const { appId, secret } = env.shopee;
  if (!appId || !secret) {
    throw new Error(
      "Configuração da Shopee incompleta: defina em Config. Afiliados (App ID + Secret) ou via SHOPEE_APP_ID/SHOPEE_SECRET no .env",
    );
  }
  return { appId, secret };
}
