import * as cheerio from "cheerio";
import { parsePreco } from "./parsePreco.js";
import { buscarPaginaMeli } from "./meliHttp.js";

/**
 * Mesma interface pública de produtoScraper.ts (resolverUrlFinal,
 * buscarDadosProduto, buscarProdutoEmPerfilSocial), reimplementada sem
 * Chrome — via `fetch()` + cookie de sessão (meliHttp.ts) + cheerio pra
 * parsear o HTML. A página do Mercado Livre é renderizada no servidor:
 * título, preço e imagem já vêm prontos, sem precisar de navegador nem
 * esperar hidratação de JS. Confirmado em produção (2026-08-13) comparando
 * a mesma página via Playwright (Chrome real) e via `fetch()` puro — HTML
 * idêntico pros seletores que usamos.
 */

/**
 * Segue redirects (bit.ly, mercadolivre.com/sec/..., meli.la) via HTTP puro
 * — precisa do cookie de sessão (ver meliHttp.ts) porque o ML bloqueia
 * requisição sem sessão logada como "tráfego suspeito".
 */
export async function resolverUrlFinal(usuarioId: number, urlBruta: string): Promise<string> {
  const { urlFinal } = await buscarPaginaMeli(usuarioId, urlBruta);
  return urlFinal;
}

export interface DadosProdutoML {
  titulo: string;
  precoOriginal: number | undefined;
  precoPromocional: number | undefined;
  imagemUrl: string | undefined;
}

/**
 * Busca a página real do produto e extrai título/preço/imagem direto do
 * HTML — nunca confia no texto/imagem do post de origem (pode vir com marca
 * d'água de outro canal, ou incompleto). Devolve null se a URL não for uma
 * página de produto reconhecível (ex.: link resolveu pra uma
 * categoria/listagem, não um produto específico).
 */
export async function buscarDadosProduto(usuarioId: number, url: string): Promise<DadosProdutoML | null> {
  const { html } = await buscarPaginaMeli(usuarioId, url);
  const $ = cheerio.load(html);

  const titulo = $("h1.ui-pdp-title").first().text().trim();
  if (!titulo) return null; // não é uma página de produto (PDP) reconhecível

  const precoAtualTexto = $(".ui-pdp-price__second-line .andes-money-amount").first().attr("aria-label") ?? null;
  const precoOriginalTexto =
    $(".ui-pdp-price__original-value .andes-money-amount, s.andes-money-amount--previous").first().attr("aria-label") ??
    null;

  // Mesmo seletor de produtoScraper.ts (ver histórico ali sobre por que
  // cobre tanto a classe no próprio <img> quanto no <div> pai, e por que
  // NÃO inclui `.ui-pdp-gallery__clip` — miniatura de vídeo, não produto).
  const imagemEl = $(
    '[class*="ui-pdp-gallery--"] img, img[class*="ui-pdp-gallery--"], .ui-pdp-gallery__figure img, figure.ui-pdp-gallery__figure img',
  ).first();
  const imagemUrl = imagemEl.attr("src") ?? imagemEl.attr("data-zoom") ?? undefined;

  const precoPromocional = parsePreco(precoAtualTexto);
  const precoOriginal = parsePreco(precoOriginalTexto) ?? precoPromocional;

  return {
    titulo,
    precoOriginal,
    precoPromocional:
      precoOriginal && precoPromocional && precoOriginal > precoPromocional ? precoPromocional : undefined,
    imagemUrl,
  };
}

function limparUrlProduto(url: string): string {
  try {
    const u = new URL(url, "https://www.mercadolivre.com.br");
    // Ver comentário equivalente em produtoScraper.ts — preserva
    // `pdp_filters` (seleciona o vendedor/preço certo numa página de
    // catálogo multi-vendedor), descarta o resto (rastreamento).
    const pdpFilters = u.searchParams.get("pdp_filters");
    const query = pdpFilters ? `?pdp_filters=${encodeURIComponent(pdpFilters)}` : "";
    return `${u.origin}${u.pathname}${query}`;
  } catch {
    return url;
  }
}

/**
 * Link de afiliado gerado pelo "Gerador de produtos recomendados" do ML
 * (`meli.la/...`) não aponta pro produto — resolve pra `/social/{usuario}`,
 * o perfil público do afiliado com o produto originalmente compartilhado em
 * destaque no topo. O card do produto original é identificável de forma
 * exata: seu link contém `c_id=/home/card-featured/element`.
 */
export async function buscarProdutoEmPerfilSocial(usuarioId: number, urlPerfil: string): Promise<string | null> {
  const { html } = await buscarPaginaMeli(usuarioId, urlPerfil);
  const $ = cheerio.load(html);

  const href = $('a[href*="c_id=/home/card-featured/element"]').first().attr("href");
  return href ? limparUrlProduto(href) : null;
}
