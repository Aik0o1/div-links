import * as configuracoesRepo from "../../repositorios/configuracoes.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class SessaoMeliExpiradaError extends Error {
  constructor() {
    super(
      'Sessão do Mercado Livre expirada ou ausente — atualize o cookie (aba Status do painel, "Cookie do Mercado Livre") e tente de novo.',
    );
    this.name = "SessaoMeliExpiradaError";
  }
}

async function cookieObrigatorio(usuarioId: number): Promise<string> {
  const cookie = await configuracoesRepo.obterMeliSessionCookie(usuarioId);
  if (!cookie) {
    await configuracoesRepo.marcarMeliCookieExpirado(usuarioId);
    throw new SessaoMeliExpiradaError();
  }
  return cookie;
}

/**
 * GET autenticado no Mercado Livre via cookie de sessão salvo — sem Chrome
 * (ver configuracoesRepo.obterMeliSessionCookie). A página do ML é renderizada
 * no servidor (SSR): título, preço e imagem já vêm prontos no HTML, sem
 * precisar executar JS nem esperar hidratação — confirmado em produção
 * (2026-08-13), a mesma página que exigia Chrome/Playwright pra raspar
 * respondeu idêntica via `fetch()` puro com o cookie certo.
 *
 * Segue redirects normalmente (serve tanto pra resolver link curto quanto
 * pra ler a página final de uma vez). Detecta a página de "tráfego
 * suspeito" (`/gz/account-verification` — aparece sem cookie válido, ou
 * quando expira — e `/captcha/wall/...`, achada em produção 2026-08-27:
 * cookie válido pra navegação geral, mas fetch de página de produto
 * específica cai nessa parede de verificação) e converte num erro claro,
 * em vez de deixar o chamador tentar extrair produto de HTML de challenge
 * (o que faria parecer, silenciosamente, que o link "não é um produto").
 */
export async function buscarPaginaMeli(usuarioId: number, url: string): Promise<{ html: string; urlFinal: string }> {
  const cookie = await cookieObrigatorio(usuarioId);

  const resposta = await fetch(url, {
    redirect: "follow",
    headers: {
      Cookie: cookie,
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9",
      // Faltavam esses (achado em produção 2026-08-27: home carregava normal,
      // só página de produto/busca caía na parede de verificação, mesmo com
      // cookie recém-renovado) — todo navegador Chrome de verdade manda esses
      // cabeçalhos de "client hints"/fetch metadata; sem eles a requisição
      // destoa o suficiente do tráfego normal pra bater em detecção de bot
      // específica dessas páginas, mesmo com sessão logada válida.
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      // "none" (não "same-origin") de propósito — não mandamos Referer
      // nenhum, então isso é o que um navegador de verdade reportaria pra
      // uma navegação direta (link colado/clicado de outro app, sem
      // referrer de dentro do próprio mercadolivre.com.br).
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  });

  const urlFinal = resposta.url;
  if (
    urlFinal.includes("/gz/account-verification") ||
    urlFinal.includes("suspicious-traffic") ||
    urlFinal.includes("/captcha/wall")
  ) {
    await configuracoesRepo.marcarMeliCookieExpirado(usuarioId);
    throw new SessaoMeliExpiradaError();
  }

  // Passou sem cair em nenhuma parede de verificação — prova que a sessão
  // está funcionando agora, então limpa qualquer aviso de cookie vencido
  // que tenha ficado de uma falha anterior (auto-recuperação, sem precisar
  // que o usuário faça nada se o problema já não existe mais).
  await configuracoesRepo.limparMeliCookieExpirado(usuarioId);

  const html = await resposta.text();
  return { html, urlFinal };
}

interface RespostaCreateLink {
  status: number;
  urls: Array<{ short_url: string; long_url: string; created: boolean }>;
  total_success: number;
}

/**
 * Gera o link curto OFICIAL (`meli.la/...`) via HTTP puro, sem Chrome —
 * chama o mesmo endpoint que o botão "Gerar" do link builder usa de
 * verdade (`/affiliate-program/api/v2/affiliates/createLink`), descoberto
 * via engenharia reversa (ver comentário em linkDireto.ts). Precisa de um
 * token CSRF, que vem embutido no HTML da própria página do link builder
 * (`<meta name="csrf-token" content="...">` — confirmado em produção,
 * 2026-08-14) — busca ele primeiro, depois faz o POST.
 *
 * Diferente do link direto (`?matt_word=...&matt_tool=...` na URL do
 * produto, ver linkDireto.ts): esse é o link CURTO real, que passa pelo
 * redirect oficial do ML — mais confiável pra ativar o rastreamento de
 * comissão do que só um parâmetro de query numa visita direta (motivo pra
 * essa função existir: link direto chegou a sair sem contar como afiliado
 * em produção, relatado pelo usuário 2026-08-14).
 */
export async function criarLinkOficial(usuarioId: number, urlProduto: string, tag: string): Promise<string> {
  const cookie = await cookieObrigatorio(usuarioId);

  const paginaLinkbuilder = await fetch("https://www.mercadolivre.com.br/afiliados/linkbuilder", {
    redirect: "follow",
    headers: {
      Cookie: cookie,
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
  });
  const html = await paginaLinkbuilder.text();
  if (paginaLinkbuilder.url.includes("/gz/account-verification")) {
    await configuracoesRepo.marcarMeliCookieExpirado(usuarioId);
    throw new SessaoMeliExpiradaError();
  }

  const csrfMatch = html.match(/name="csrf-token"\s+content="([^"]+)"/);
  if (!csrfMatch) {
    throw new Error("Não achei o token CSRF no HTML do link builder — layout do ML pode ter mudado");
  }
  const csrfToken = csrfMatch[1];

  const resposta = await fetch("https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink", {
    method: "POST",
    headers: {
      Cookie: cookie,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      "x-csrf-token": csrfToken,
      Referer: "https://www.mercadolivre.com.br/afiliados/linkbuilder",
    },
    body: JSON.stringify({ urls: [urlProduto], tag }),
  });

  if (!resposta.ok) {
    throw new Error(`Mercado Livre respondeu ${resposta.status} ao criar link de afiliado pra "${urlProduto}"`);
  }

  const dados = (await resposta.json()) as RespostaCreateLink;
  const item = dados.urls?.[0];
  if (!item?.created || !item.short_url) {
    throw new Error(`Mercado Livre não gerou link pra "${urlProduto}" (resposta: ${JSON.stringify(dados)})`);
  }

  return item.short_url;
}
