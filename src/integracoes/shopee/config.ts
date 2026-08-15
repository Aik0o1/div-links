import { obterShopeeConfig, type ShopeeConfig } from "../../repositorios/configuracoes.js";

/**
 * Credenciais efetivas da Shopee do tenant — só o que está configurado por
 * ele mesmo (aba Config. Afiliados), sem fallback pra `.env`. Fallback pro
 * `.env` existiu até 2026-08-15 e foi removido nesse commit (transformação
 * multi-tenant): em SaaS ele vazaria as credenciais/comissão do Victor pra
 * qualquer tenant que ainda não tivesse configurado a própria conta —
 * tenant sem config própria precisa de um erro claro, nunca de um fallback
 * silencioso pra conta de outro tenant.
 */
export async function obterShopeeConfigEfetiva(usuarioId: number): Promise<ShopeeConfig> {
  const doBanco = await obterShopeeConfig(usuarioId);
  if (doBanco?.appId && doBanco?.secret) return doBanco;

  throw new Error(
    "Configuração da Shopee incompleta: defina App ID + Secret em Config. Afiliados",
  );
}
