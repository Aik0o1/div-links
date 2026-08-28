import * as cheerio from "cheerio";
import { parsePreco } from "./parsePreco.js";
import { buscarPaginaMeli } from "./meliHttp.js";

/**
 * Desescapa qualquer sequência `\uXXXX` de dentro do JSON embutido na página
 * de perfil social (ver buscarProdutoEmPerfilSocial) — não só `/` (`/`,
 * o caso mais comum), já que título de produto real pode ter outros
 * caracteres escapados assim (`&`, aspas tipográficas, etc.). Bug real
 * encontrado em produção: título com "/" no meio (ex.: código de modelo
 * "QP1425/10") aparecia com o `/` literal na tela, porque só a URL
 * era desescapada, não o título.
 */
function desescaparUnicode(texto: string): string {
  return texto.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

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
 * Monta a URL de imagem do CDN do ML a partir só do id da foto (achado no
 * JSON do polycard, ver buscarProdutoEmPerfilSocial) — não tem doc oficial
 * pra esse formato, testado manualmente em produção (2026-08-27) até achar
 * uma combinação que devolve um webp de verdade (não um placeholder): `NQ`
 * (sem limite de qualidade) + `NP_2X` (retina) + sufixo `-F` (resolução
 * "full", a maior das testadas — as demais como `-O`/`-V` também funcionam,
 * só em resolução menor).
 */
function montarUrlImagem(pictureId: string): string {
  return `https://http2.mlstatic.com/D_NQ_NP_2X_${pictureId}-F.webp`;
}

/**
 * Varre todo campo `"url":"https:...` do HTML (texto puro, sem regex — ver
 * comentário em buscarProdutoEmPerfilSocial) até achar um cujo VALOR
 * contenha `procurado` — é assim que se acha o link "Ir para produto"
 * (dentro de `action_links`) sem depender de posição fixa no documento.
 */
function acharValorDeUrlContendo(html: string, procurado: string): { valor: string; indice: number } | null {
  const chave = '"url":"https:';
  let posBusca = 0;
  while (true) {
    const inicioChave = html.indexOf(chave, posBusca);
    if (inicioChave === -1) return null;
    const inicioValor = inicioChave + '"url":"'.length;
    const fimValor = html.indexOf('"', inicioValor);
    if (fimValor === -1) return null;
    const valor = html.slice(inicioValor, fimValor);
    if (valor.includes(procurado)) return { valor, indice: inicioChave };
    posBusca = fimValor + 1;
  }
}

/**
 * Link de afiliado gerado pelo "Gerador de produtos recomendados" do ML
 * (`meli.la/...`) não aponta pro produto — resolve pra `/social/{usuario}`,
 * o perfil público do afiliado com o produto originalmente compartilhado em
 * destaque no topo. O card do produto original é identificável de forma
 * exata: seu link contém `c_id=/home/card-featured/element`.
 *
 * Essa página de perfil social é hidratada no cliente (diferente da PDP) —
 * o link do card em destaque não existe mais como `<a href>` literal no
 * HTML do servidor, só dentro de um JSON de estado embutido num `<script>`
 * (com toda barra `/` escapada como `/`), usado pelo React pra montar
 * o carrossel depois. Descoberto em produção (2026-08-27): o seletor via
 * cheerio parou de achar qualquer link nessa página (0 produtos de perfil
 * social capturados por dias), mesmo com o card presente no JSON embutido.
 * Por isso busca primeiro no DOM (caso o ML volte a renderizar como link
 * de verdade) e cai pro parsing do JSON bruto como fallback: acha o
 * marcador `c_id=/home/card-featured/element` (escapado) dentro do texto,
 * depois acha o campo `"url":"..."` que o envolve (o marcador é só mais um
 * parâmetro de query dentro do valor desse campo) e desescapa.
 *
 * `dados` vem preenchido a partir do MESMO JSON, sem precisar de uma
 * segunda requisição pra página do produto em si — importante desde que o
 * ML passou a bloquear fetch direto de página de produto/busca com uma
 * parede de captcha (achado em produção 2026-08-27, ver comentário em
 * meliHttp.ts), mesmo com sessão logada válida; a página de perfil social
 * não cai nessa parede. `dados` só vem `null` se algum dos três campos
 * (título/preço/imagem) não bater com o formato esperado — mais raro que a
 * própria URL não ser achada, mas cada campo é extraído de forma
 * independente, então um formato novo em só um deles não derruba os outros.
 *
 * A posição EXATA do marcador dentro do JSON varia entre respostas (a
 * recomendação roda um pouco a cada fetch — testado com o mesmo link
 * várias vezes seguidas em produção, 2026-08-27), então em vez de assumir
 * uma direção fixa (antes/depois), o campo `"url"` certo é achado pelo
 * CONTEÚDO (o único `"url":"..."` cujo valor contém o marcador — identifica
 * sem ambiguidade o link "Ir para produto" dentro de `action_links`, nunca
 * o `metadata.url`/`url_fragments`, mais curtos e sem esse marcador
 * embutido). Os outros campos (título/preço/imagem) SEMPRE vêm ANTES desse
 * link dentro do mesmo polycard (`pictures` → `components: [title, seller,
 * price, shipping, action_links]`, nessa ordem fixa do schema), então
 * busca pra trás a partir dele.
 */
export async function buscarProdutoEmPerfilSocial(
  usuarioId: number,
  urlPerfil: string,
): Promise<{ url: string; dados: DadosProdutoML | null } | null> {
  const { html } = await buscarPaginaMeli(usuarioId, urlPerfil);

  // Busca por texto puro (não regex) de propósito: o marcador contém barras
  // escapadas como a sequência literal `/` (6 caracteres), que dentro
  // de um padrão de regex seria reinterpretada como escape Unicode de "/"
  // (1 caractere) — bug real encontrado construindo isso, corrigido antes
  // de ir pra produção.
  //
  // Tenta o JSON primeiro (traz URL + título/preço/imagem juntos, numa
  // passada só) — só cai pro `<a href>` do DOM (às vezes existe de
  // verdade, não só no JSON de hidratação — achado em produção 2026-08-27
  // testando o mesmo link várias vezes: umas horas tem o link real no
  // HTML, outras só no JSON) como último recurso, que só dá a URL, sem os
  // outros dados.
  const marcador = "c_id=\\u002Fhome\\u002Fcard-featured\\u002Felement";
  const achado = acharValorDeUrlContendo(html, marcador);
  if (!achado) {
    const $ = cheerio.load(html);
    const href = $('a[href*="c_id=/home/card-featured/element"]').first().attr("href");
    return href ? { url: limparUrlProduto(href), dados: null } : null;
  }

  const url = limparUrlProduto(desescaparUnicode(achado.valor));
  const idxActionUrl = achado.indice;

  // Janela pra trás a partir do link "Ir para produto" — cobre um polycard
  // inteiro sem risco de pegar dado de um item vizinho (confirmado nos
  // exemplos reais usados pra descobrir esse formato).
  const janela = html.slice(Math.max(0, idxActionUrl - 4000), idxActionUrl);

  const tituloMatch = [...janela.matchAll(/"title":\{"text":"([^"]*)"/g)].at(-1);
  const pictureIdMatch = [...janela.matchAll(/"pictures":\[\{"id":"([^"]+)"/g)].at(-1);
  const precoAtualMatch = [...janela.matchAll(/"current_price":\{"value":([\d.]+)/g)].at(-1);
  const precoAnteriorMatch = [...janela.matchAll(/"previous_price":\{"value":([\d.]+)/g)].at(-1);

  if (!tituloMatch || !precoAtualMatch) return { url, dados: null };

  const precoAtual = Number(precoAtualMatch[1]);
  const precoAnterior = precoAnteriorMatch ? Number(precoAnteriorMatch[1]) : precoAtual;

  return {
    url,
    dados: {
      titulo: desescaparUnicode(tituloMatch[1]),
      precoOriginal: precoAnterior,
      precoPromocional: precoAnterior > precoAtual ? precoAtual : undefined,
      imagemUrl: pictureIdMatch ? montarUrlImagem(pictureIdMatch[1]) : undefined,
    },
  };
}
