import { createHash } from "node:crypto";
import { requiredShopeeConfig } from "../../config/env.js";

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

/**
 * API oficial de afiliados da Shopee (GraphQL) — substitui a tentativa
 * anterior de automatizar o site (bloqueada por detecção de bot/captcha, ver
 * PROJECT_STATUS.md). Autenticação por assinatura HMAC-like: SHA256 de
 * `appId + timestamp + payload + secret` concatenados sem separador,
 * timestamp em segundos (não ms) e precisa estar próximo do horário do
 * servidor da Shopee.
 */
function assinar(appId: string, timestamp: number, payload: string, secret: string): string {
  return createHash("sha256").update(`${appId}${timestamp}${payload}${secret}`).digest("hex");
}

async function chamarGraphQL<T>(query: string): Promise<T> {
  const { appId, secret } = requiredShopeeConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ query });
  const signature = assinar(appId, timestamp, payload, secret);

  const resposta = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  });

  const corpo = (await resposta.json()) as { data?: T; errors?: unknown };
  if (corpo.errors) {
    throw new Error(`Shopee API recusou a requisição: ${JSON.stringify(corpo.errors)}`);
  }
  if (!corpo.data) {
    throw new Error(`Shopee API não retornou dados (status ${resposta.status})`);
  }
  return corpo.data;
}

interface RespostaGenerateShortLink {
  generateShortLink: { shortLink: string } | null;
}

export async function gerarLinkAfiliado(urlProduto: string): Promise<string> {
  const query = `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(urlProduto)} }) { shortLink } }`;
  const dados = await chamarGraphQL<RespostaGenerateShortLink>(query);

  const link = dados.generateShortLink?.shortLink;
  if (!link) throw new Error(`Shopee não retornou link de afiliado pra "${urlProduto}"`);
  return link;
}
