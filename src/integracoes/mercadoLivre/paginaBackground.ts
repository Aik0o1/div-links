import type { Browser, Page } from "playwright";

/**
 * Abre uma aba nova SEM ativá-la — `contexto.newPage()` do Playwright cria a
 * aba via CDP `Target.createTarget` sem a flag `background`, o que faz o
 * Chrome trazer aquela aba (e a janela real do usuário) pra frente. Isso
 * atrapalhava quem tá usando o PC: toda vez que o scraping abria uma página
 * (captura de ofertas, produto de grupo monitorado, etc.), a janela do Chrome
 * saltava pra frente trocando de aba sozinha.
 *
 * Aqui chamamos o CDP direto com `background: true`, que cria a aba mas
 * mantém a aba/janela atual em foco — a raspagem roda "em standby", sem
 * interromper o usuário.
 */
async function criarPaginaEmBackground(browser: Browser): Promise<Page> {
  const contexto = browser.contexts()[0];
  const sessao = await browser.newBrowserCDPSession();

  try {
    const aguardaPagina = contexto.waitForEvent("page", { timeout: 10000 });
    await sessao.send("Target.createTarget", { url: "about:blank", background: true });
    return await aguardaPagina;
  } finally {
    await sessao.detach().catch(() => {});
  }
}

// Fila que serializa as aberturas de aba. Com uma conexão CDP única
// compartilhada (ver browserConexao.ts), duas chamadas concorrentes a
// `abrirPaginaEmBackground` (ex.: disparo automático + monitor de grupos
// rodando ao mesmo tempo) escutavam o mesmo evento "page" do contexto — cada
// uma podia acabar pegando a aba criada pela OUTRA chamada por engano,
// causando "Target page, context or browser has been closed" quando uma
// fechava a aba que a outra ainda achava que era sua. Serializar a criação
// (uma aba de cada vez) elimina essa ambiguidade.
let filaAbertura: Promise<unknown> = Promise.resolve();

export function abrirPaginaEmBackground(browser: Browser): Promise<Page> {
  const resultado = filaAbertura.then(
    () => criarPaginaEmBackground(browser),
    () => criarPaginaEmBackground(browser),
  );
  filaAbertura = resultado.catch(() => {});
  return resultado;
}
