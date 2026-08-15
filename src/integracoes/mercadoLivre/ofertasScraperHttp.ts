import * as cheerio from "cheerio";
import type { ProdutoBruto } from "../../types/produto.js";
import { parsePreco } from "./parsePreco.js";
import { buscarPaginaMeli } from "./meliHttp.js";

// Mesma interface pública de ofertasScraper.ts, sem Chrome (ver
// produtoScraperHttp.ts pro raciocínio completo — a aba Ofertas também é
// renderizada no servidor, confirmado em produção 2026-08-13: 23 cards
// completos vieram no HTML puro via `fetch()` + cookie).

const OFERTAS_URL = "https://www.mercadolivre.com.br/ofertas";

interface OfertaExtraida {
  titulo: string;
  url: string;
  imagemUrl: string | null;
  precoAtualTexto: string | null;
  precoOriginalTexto: string | null;
}

function limparUrl(url: string): string {
  try {
    const u = new URL(url);
    // Preserva `pdp_filters` (ex.: `deal:MLB...`, marca a oferta específica
    // da aba Ofertas) — mesmo raciocínio de produtoScraper.ts: descartar
    // pode fazer a página final mostrar um preço/vendedor diferente do que
    // apareceu na listagem. O resto (fragmento `#polycard_client=...`,
    // tracking_id, wid, sid) é só telemetria da listagem, sem efeito na
    // página do produto — descarta.
    const pdpFilters = u.searchParams.get("pdp_filters");
    const query = pdpFilters ? `?pdp_filters=${encodeURIComponent(pdpFilters)}` : "";
    return `${u.origin}${u.pathname}${query}`;
  } catch {
    return url;
  }
}

async function extrairOfertasDaPagina(usuarioId: number, numeroPagina: number, categoriaId?: string): Promise<OfertaExtraida[]> {
  const url = new URL(OFERTAS_URL);
  url.searchParams.set("page", String(numeroPagina));
  if (categoriaId) url.searchParams.set("category", categoriaId);

  const { html } = await buscarPaginaMeli(usuarioId, url.toString());
  const $ = cheerio.load(html);

  return $(".poly-card")
    .map((_, card) => {
      const $card = $(card);
      const tituloEl = $card.find(".poly-component__title").first();
      const img = $card.find("img").first();
      const precoAtualEl = $card.find(".poly-price__current .andes-money-amount").first();
      const precoAnteriorEl = $card.find(".andes-money-amount--previous").first();
      return {
        titulo: tituloEl.text().trim(),
        url: tituloEl.attr("href") ?? "",
        imagemUrl: img.attr("src") ?? null,
        precoAtualTexto: precoAtualEl.attr("aria-label") ?? null,
        precoOriginalTexto: precoAnteriorEl.attr("aria-label") ?? null,
      };
    })
    .get();
}

/** Se categoriaId for informado, busca só ofertas dessa categoria real do ML (ex: "MLB1246"). */
export async function buscarOfertasMercadoLivre(usuarioId: number, paginas: number, categoriaId?: string): Promise<ProdutoBruto[]> {
  const todasOfertas: OfertaExtraida[] = [];

  for (let p = 1; p <= paginas; p++) {
    const ofertas = await extrairOfertasDaPagina(usuarioId, p, categoriaId);
    todasOfertas.push(...ofertas);
  }

  return todasOfertas
    .filter((o) => o.titulo && o.url)
    .map((o) => {
      const precoPromocional = parsePreco(o.precoAtualTexto);
      const precoOriginal = parsePreco(o.precoOriginalTexto) ?? precoPromocional;

      return {
        fonte: "mercado_livre",
        urlOriginal: limparUrl(o.url),
        capturadoEm: new Date().toISOString(),
        dadosEstruturados: {
          titulo: o.titulo,
          precoOriginal,
          precoPromocional:
            precoOriginal && precoPromocional && precoOriginal > precoPromocional ? precoPromocional : undefined,
          imagemUrl: o.imagemUrl ?? undefined,
        },
      } satisfies ProdutoBruto;
    });
}
