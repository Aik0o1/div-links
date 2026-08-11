import { parsePreco } from "./parsePreco.js";
import { abrirPaginaEmBackground } from "./paginaBackground.js";
import { obterBrowser } from "./browserConexao.js";

// Todas as navegações aqui usam `domcontentloaded`, não `load` — as abas são
// abertas em background (ver paginaBackground.ts, pra não roubar o foco do
// usuário), e o Chrome throttling forte o carregamento de recursos (imagens
// etc.) de abas em background: sob uso real (várias capturas concorrentes),
// o evento "load" completo simplesmente não disparava a tempo, dando
// timeout em 100% das tentativas de captura de produto de grupo monitorado.
// `domcontentloaded` (HTML parseado, sem esperar imagens) já é suficiente
// pros seletores que usamos, que vêm do HTML inicial renderizado pelo ML.

/**
 * Segue redirects (bit.ly, mercadolivre.com/sec/..., meli.la) via a janela
 * real do Chrome — igual o resto do sistema, `fetch()` puro leva 403 do ML.
 */
export async function resolverUrlFinal(urlBruta: string): Promise<string> {
  const browser = await obterBrowser();
  const pagina = await abrirPaginaEmBackground(browser);
  try {
    await pagina.goto(urlBruta, { waitUntil: "domcontentloaded", timeout: 20000 });
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
    await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
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
    // O seletor antigo (`.ui-pdp-gallery__figure img`) parou de bater com
    // NADA — o ML trocou a estrutura da galeria. Confirmado em produção
    // (2026-08-07, via diagnóstico temporário) que a imagem principal hoje é
    // o próprio `<img>` com uma classe `ui-pdp-gallery--<orientação>`
    // (`--horizontal` ou `--vertical`, dependendo do layout/template do
    // anúncio — não tem como prever qual de antemão), não mais dentro de
    // `<figure>`. Isso derrubava pra 0% a captura de imagem de TODO produto
    // de grupo monitorado (Telegram e WhatsApp), que sempre passa por aqui —
    // produto sem imagem nunca é reenviado (ver dispararProduto.ts), então
    // cada um virava perda permanente. `[class*="ui-pdp-gallery--"]` casa com
    // qualquer orientação (atual ou futura) direto na própria tag `<img>`,
    // sem depender de qual container pai o ML decidir usar. Mantém os
    // seletores antigos por último, por segurança, caso o ML volte a usar
    // esses layouts em algum template.
    const imagemEl = pagina
      .locator(
        'img[class*="ui-pdp-gallery--"], .ui-pdp-gallery__clip img, .ui-pdp-gallery__figure img, figure.ui-pdp-gallery__figure img',
      )
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

/**
 * Descarta os parâmetros de rastreamento da URL do card (matt_*, ref, wid,
 * sid, reco_*, tracking_id, c_id, c_uid — só servem pra métrica interna do
 * ML), mas **preserva `pdp_filters`**. Diferente dos outros, esse não é
 * rastreamento: numa página de catálogo (`/p/MLB...`) com vários vendedores
 * pro mesmo produto, ele que seleciona QUAL vendedor/anúncio mostrar —
 * inclusive qual preço aparece. Bug real (2026-08-11): descartava ele junto
 * com o resto, então a raspagem caía sempre no vendedor padrão da página
 * genérica em vez do que estava de fato em destaque no card — preço saía
 * errado (de um vendedor diferente do anunciado).
 */
function limparUrlProduto(url: string): string {
  try {
    const u = new URL(url, "https://www.mercadolivre.com.br");
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
 * destaque no topo, seguido de uma vitrine de recomendações genéricas
 * ("Quem viu este produto também comprou") sem relação nenhuma com o que foi
 * postado. O card do produto original é identificável de forma exata: seu
 * link contém `c_id=/home/card-featured/element` — não precisa (e não deve)
 * adivinhar por palavras em comum com o texto do post, o próprio ML já
 * marca qual é o item certo.
 */
export async function buscarProdutoEmPerfilSocial(urlPerfil: string): Promise<string | null> {
  const browser = await obterBrowser();
  const pagina = await abrirPaginaEmBackground(browser);

  try {
    await pagina.goto(urlPerfil, { waitUntil: "domcontentloaded", timeout: 20000 });
    await pagina.waitForSelector(".poly-card", { timeout: 8000 }).catch(() => {});

    const href = await pagina
      .locator('a[href*="c_id=/home/card-featured/element"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    return href ? limparUrlProduto(href) : null;
  } finally {
    await pagina.close();
  }
}
