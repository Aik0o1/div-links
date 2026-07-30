import { createHash } from "node:crypto";
import { obterShopeeConfigEfetiva } from "./config.js";

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
  const { appId, secret } = await obterShopeeConfigEfetiva();
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

interface RespostaProductOfferPorItem {
  productOfferV2: { nodes: { imageUrl: string }[] };
}

// Dois formatos reais de URL de produto observados após seguir o redirect do
// link curto: a forma "amigável pra SEO" com o título por extenso
// ("...-i.<shopId>.<itemId>?...", a mais comum) e a forma simples
// ("shopee.com.br/product/<shopId>/<itemId>" ou "/<slug>/<shopId>/<itemId>").
// Tenta a primeira antes (mais específica, evita casar números soltos de
// outra parte do path por engano).
const REGEX_SHOP_ITEM_ID_SEO = /-i\.(\d+)\.(\d+)(?:[/?]|$)/;
const REGEX_SHOP_ITEM_ID_SIMPLES = /\/(\d+)\/(\d+)(?:[/?]|$)/;

/**
 * Imagem OFICIAL do produto (CDN da Shopee, sem marca d'água de terceiro) a
 * partir de um link curto/direto do produto — segue o redirect pra achar
 * `shopId`/`itemId` embutidos na URL real, depois consulta `productOfferV2`
 * por item específico. Existe porque a imagem de um post de grupo monitorado
 * pode ter logo/marca d'água do próprio grupo — nunca deve ser usada como
 * imagem do produto (decisão explícita do usuário, bug real relatado).
 * `null` quando não dá pra resolver (link mudou de formato, produto saiu do
 * ar, etc.) — cabe a quem chama decidir não publicar o produto sem imagem
 * confiável, nunca cair de volta pra imagem do post.
 */
export async function buscarImagemOficialProduto(urlProduto: string): Promise<string | null> {
  const resposta = await fetch(urlProduto, { redirect: "follow" });
  const match = resposta.url.match(REGEX_SHOP_ITEM_ID_SEO) ?? resposta.url.match(REGEX_SHOP_ITEM_ID_SIMPLES);
  if (!match) return null;
  const [, shopId, itemId] = match;

  const query = `query { productOfferV2(itemId: ${itemId}, shopId: ${shopId}, limit: 1) { nodes { imageUrl } } }`;
  const dados = await chamarGraphQL<RespostaProductOfferPorItem>(query);
  return dados.productOfferV2?.nodes[0]?.imageUrl ?? null;
}
