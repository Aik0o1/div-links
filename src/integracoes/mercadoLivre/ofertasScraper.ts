import type { ProdutoBruto } from "../../types/produto.js";
import { parsePreco } from "./parsePreco.js";
import { abrirPaginaEmBackground } from "./paginaBackground.js";
import { obterBrowser } from "./browserConexao.js";

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
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

async function extrairOfertasDaPagina(
  numeroPagina: number,
  categoriaId?: string,
): Promise<OfertaExtraida[]> {
  const browser = await obterBrowser();
  const pagina = await abrirPaginaEmBackground(browser);

  const url = new URL(OFERTAS_URL);
  url.searchParams.set("page", String(numeroPagina));
  if (categoriaId) url.searchParams.set("category", categoriaId);

  try {
    await pagina.goto(url.toString(), { waitUntil: "load", timeout: 20000 });
    await pagina.waitForSelector(".poly-card", { timeout: 10000 }).catch(() => {});

    return await pagina.locator(".poly-card").evaluateAll((cards: any[]) =>
      cards.map((card) => {
        const tituloEl = card.querySelector(".poly-component__title");
        const img = card.querySelector("img");
        const precoAtualEl = card.querySelector(".poly-price__current .andes-money-amount");
        const precoAnteriorEl = card.querySelector(".andes-money-amount--previous");
        return {
          titulo: tituloEl?.textContent?.trim() ?? "",
          url: tituloEl?.href ?? "",
          imagemUrl: img?.getAttribute("src") ?? null,
          precoAtualTexto: precoAtualEl?.getAttribute("aria-label") ?? null,
          precoOriginalTexto: precoAnteriorEl?.getAttribute("aria-label") ?? null,
        };
      }),
    );
  } finally {
    await pagina.close();
  }
}

/** Se categoriaId for informado, busca só ofertas dessa categoria real do ML (ex: "MLB1246"). */
export async function buscarOfertasMercadoLivre(
  paginas: number,
  categoriaId?: string,
): Promise<ProdutoBruto[]> {
  const todasOfertas: OfertaExtraida[] = [];

  for (let p = 1; p <= paginas; p++) {
    const ofertas = await extrairOfertasDaPagina(p, categoriaId);
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
            precoOriginal && precoPromocional && precoOriginal > precoPromocional
              ? precoPromocional
              : undefined,
          imagemUrl: o.imagemUrl ?? undefined,
        },
      } satisfies ProdutoBruto;
    });
}
