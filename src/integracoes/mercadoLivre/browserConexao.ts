import { chromium, type Browser } from "playwright";

const CDP_URL = "http://localhost:9222";

let browserPromise: Promise<Browser> | null = null;

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
    .then((browser) => {
      browser.once("disconnected", () => {
        if (browserPromise === promessa) browserPromise = null;
      });
    })
    .catch(() => {
      if (browserPromise === promessa) browserPromise = null;
    });

  return promessa;
}
