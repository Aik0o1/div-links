import { createHash } from "node:crypto";
import { obterShopeeConfigEfetiva } from "./config.js";

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

function assinar(appId: string, timestamp: number, payload: string, secret: string): string {
  return createHash("sha256").update(`${appId}${timestamp}${payload}${secret}`).digest("hex");
}

async function chamarGraphQL<T>(usuarioId: number, query: string): Promise<T> {
  const { appId, secret } = await obterShopeeConfigEfetiva(usuarioId);
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

export interface OfertaShopee {
  itemId: number;
  titulo: string;
  imagemUrl: string;
  productLink: string;
  offerLink: string;
  precoPromocional: number;
  descontoPercentual: number;
}

interface NoProductOffer {
  itemId: number;
  productName: string;
  imageUrl: string;
  productLink: string;
  offerLink: string;
  priceMin: string;
  priceDiscountRate: number;
}

interface RespostaProductOfferV2 {
  productOfferV2: { nodes: NoProductOffer[] };
}

/**
 * Ofertas da Shopee via `productOfferV2` — diferente de generateShortLink,
 * esse endpoint já devolve o `offerLink` pronto (link de afiliado já
 * rastreado com a nossa conta), sem precisar gerar separado. Sem `keyword`,
 * pega o catálogo geral (mesma ideia do nicho "geral" do Mercado Livre); com
 * `keyword`, filtra por termo de busca — não existe um filtro de categoria
 * confiável equivalente ao "category=MLB..." do ML (ver nichoKeywords.ts).
 */
export async function buscarOfertasShopee(
  usuarioId: number,
  paginas: number,
  itensPorPagina = 20,
  keyword?: string,
): Promise<OfertaShopee[]> {
  const todas: OfertaShopee[] = [];
  const filtroKeyword = keyword ? `, keyword: ${JSON.stringify(keyword)}` : "";

  for (let pagina = 1; pagina <= paginas; pagina++) {
    const query = `query { productOfferV2(page: ${pagina}, limit: ${itensPorPagina}${filtroKeyword}) { nodes { itemId productName imageUrl productLink offerLink priceMin priceDiscountRate } } }`;
    const dados = await chamarGraphQL<RespostaProductOfferV2>(usuarioId, query);
    const nodes = dados.productOfferV2?.nodes ?? [];
    if (nodes.length === 0) break;

    for (const n of nodes) {
      todas.push({
        itemId: n.itemId,
        titulo: n.productName,
        imagemUrl: n.imageUrl,
        productLink: n.productLink,
        offerLink: n.offerLink,
        precoPromocional: Number(n.priceMin),
        descontoPercentual: n.priceDiscountRate,
      });
    }
  }

  return todas;
}
