import { parsePreco } from "./parsePreco.js";
import { abrirPaginaEmBackground } from "./paginaBackground.js";
import { obterBrowser } from "./browserConexao.js";

/**
 * Segue redirects (bit.ly, mercadolivre.com/sec/..., meli.la) via a janela
 * real do Chrome — igual o resto do sistema, `fetch()` puro leva 403 do ML.
 */
export async function resolverUrlFinal(urlBruta: string): Promise<string> {
  const browser = await obterBrowser();
  const pagina = await abrirPaginaEmBackground(browser);
  try {
    await pagina.goto(urlBruta, { waitUntil: "load", timeout: 20000 });
    return pagina.url();
  } finally {
    await pagina.close();
  }
}

export interface DadosProdutoML {
  titulo: string;
  precoOriginal: number | undefined;
  precoPromocional: number | undefined;
  imagemUrl: string | undefined;
}

/**
 * Abre a página real do produto (aba nova, não mexe na aba do link builder)
 * e extrai título/preço/imagem direto do DOM — nunca confia no texto/imagem
 * do post de origem (pode vir com marca d'água de outro canal, ou incompleto).
 * Devolve null se a URL não for uma página de produto reconhecível (ex.:
 * link resolveu pra uma categoria/listagem, não um produto específico).
 */
export async function buscarDadosProduto(url: string): Promise<DadosProdutoML | null> {
  const browser = await obterBrowser();
  const pagina = await abrirPaginaEmBackground(browser);

  try {
    await pagina.goto(url, { waitUntil: "load", timeout: 20000 });
    await pagina.waitForSelector("h1.ui-pdp-title", { timeout: 8000 }).catch(() => {});

    const titulo = (await pagina.locator("h1.ui-pdp-title").textContent().catch(() => null))?.trim();
    if (!titulo) return null; // não é uma página de produto (PDP) reconhecível

    const precoAtualTexto = await pagina
      .locator(".ui-pdp-price__second-line .andes-money-amount")
      .first()
      .getAttribute("aria-label")
      .catch(() => null);
    const precoOriginalTexto = await pagina
      .locator(".ui-pdp-price__original-value .andes-money-amount, s.andes-money-amount--previous")
      .first()
      .getAttribute("aria-label")
      .catch(() => null);
    const imagemEl = pagina
      .locator(".ui-pdp-gallery__figure img, figure.ui-pdp-gallery__figure img")
      .first();
    const imagemUrl =
      (await imagemEl.getAttribute("src").catch(() => null)) ??
      (await imagemEl.getAttribute("data-zoom").catch(() => null));

    const precoPromocional = parsePreco(precoAtualTexto);
    const precoOriginal = parsePreco(precoOriginalTexto) ?? precoPromocional;

    return {
      titulo,
      precoOriginal,
      precoPromocional:
        precoOriginal && precoPromocional && precoOriginal > precoPromocional
          ? precoPromocional
          : undefined,
      imagemUrl: imagemUrl ?? undefined,
    };
  } finally {
    await pagina.close();
  }
}

function tokenizar(texto: string): string[] {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // remove acentos (marcas de combinação após normalize NFD)
      .match(/[a-z0-9]{3,}/g) ?? []
  );
}

function limparUrlProduto(url: string): string {
  try {
    const u = new URL(url, "https://www.mercadolivre.com.br");
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Link de afiliado gerado pelo "Gerador de produtos recomendados" do ML
 * (`meli.la/...`) não aponta pro produto — resolve pra `/social/{usuario}`,
 * o perfil público do afiliado com VÁRIAS recomendações (mesmo componente
 * `.poly-card` da aba Ofertas). Não tem como saber qual é o produto certo só
 * pela URL, então casa por palavras em comum entre o texto original da
 * mensagem e o título de cada card — exige pelo menos 2 palavras batendo
 * pra aceitar (evita escolher o card errado quando não bate nada).
 */
export async function buscarProdutoEmPerfilSocial(
  urlPerfil: string,
  textoOriginal: string,
): Promise<string | null> {
  const browser = await obterBrowser();
  const pagina = await abrirPaginaEmBackground(browser);

  try {
    await pagina.goto(urlPerfil, { waitUntil: "load", timeout: 20000 });
    await pagina.waitForSelector(".poly-card", { timeout: 8000 }).catch(() => {});

    const cards = pagina.locator(".poly-card");
    const total = await cards.count();
    if (total === 0) return null;

    const tokensTexto = tokenizar(textoOriginal);
    let melhorUrl: string | null = null;
    let melhorPontuacao = 0;

    for (let i = 0; i < total; i++) {
      const tituloEl = cards.nth(i).locator(".poly-component__title");
      const titulo = (await tituloEl.textContent().catch(() => null))?.trim();
      const href = await tituloEl.getAttribute("href").catch(() => null);
      if (!titulo || !href) continue;

      const pontuacao = tokenizar(titulo).filter((t) => tokensTexto.includes(t)).length;
      if (pontuacao > melhorPontuacao) {
        melhorPontuacao = pontuacao;
        melhorUrl = href;
      }
    }

    if (melhorPontuacao < 2) return null;
    return limparUrlProduto(melhorUrl!);
  } finally {
    await pagina.close();
  }
}
