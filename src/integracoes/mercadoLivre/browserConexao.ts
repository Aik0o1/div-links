import { chromium, type Browser } from "playwright";

const CDP_URL = "http://localhost:9222";

// Única aba que a automação mantém aberta de propósito — todas as outras
// abas do Mercado Livre no profile são efêmeras (abertas em background pra
// scraping, ver paginaBackground.ts) e fecham sozinhas quando terminam.
const LINKBUILDER_URL_PREFIX = "https://www.mercadolivre.com.br/afiliados/linkbuilder";

let browserPromise: Promise<Browser> | null = null;

/**
 * Fecha aba efêmera que ficou pra trás de uma conexão anterior mal encerrada
 * (processo morto/reiniciado no meio de uma captura — o Chrome real é outro
 * processo, não morre junto, então a aba fica órfã no perfil). Roda só uma
 * vez por conexão nova (não a cada `obterBrowser()`), pra não brigar com
 * abas que a própria captura em andamento acabou de abrir. Confirmado em
 * produção (2026-08-09): mais de 100 abas de ML acumuladas depois de vários
 * restarts do processo, restauradas de uma vez ao reabrir o Chrome.
 */
async function limparAbasOrfas(browser: Browser): Promise<void> {
  const contexto = browser.contexts()[0];
  if (!contexto) return;
  for (const pagina of contexto.pages()) {
    const url = pagina.url();
    if (url.startsWith(LINKBUILDER_URL_PREFIX) || url === "about:blank") continue;
    await pagina.close().catch(() => {});
  }
}

/**
 * Conexão CDP única, reaproveitada por todo o processo. Antes, cada função de
 * scraping (buscarDadosProduto, extrairOfertasDaPagina, etc.) chamava
 * `chromium.connectOverCDP()` a cada execução e nunca fechava a conexão —
 * nunca chamamos `.close()` de propósito, pra não arriscar encerrar a janela
 * real do usuário (ver comentário em status.ts). Isso significava um
 * Browser/Context/CDPSession novo (com seus próprios listeners e sockets) a
 * cada captura de produto, cada disparo, cada mensagem de grupo monitorado —
 * vazava memória sem limite até o processo cair com "JavaScript heap out of
 * memory" depois de ~1h50 rodando, derrubando junto o disparo automático e o
 * monitoramento até alguém reiniciar manualmente.
 */
export async function obterBrowser(): Promise<Browser> {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (browser.isConnected()) return browser;
    } catch {
      // conexão anterior falhou — segue abaixo pra tentar reconectar
    }
    browserPromise = null;
  }

  const promessa = chromium.connectOverCDP(CDP_URL);
  browserPromise = promessa;

  promessa
    .then(async (browser) => {
      browser.once("disconnected", () => {
        if (browserPromise === promessa) browserPromise = null;
      });
      await limparAbasOrfas(browser);
    })
    .catch(() => {
      if (browserPromise === promessa) browserPromise = null;
    });

  return promessa;
}
