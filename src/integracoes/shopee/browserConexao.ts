import { chromium, type Browser } from "playwright";

// Porta e janela SEPARADAS da do Mercado Livre (ver browserConexao.ts em
// integracoes/mercadoLivre) — o Chrome/perfil usado pro ML não conseguiu
// abrir o site da Shopee (bloqueio/detecção de automação naquele perfil).
const CDP_URL = "http://localhost:9223";

let browserPromise: Promise<Browser> | null = null;

/** Conexão CDP única com a janela dedicada da Shopee, reaproveitada por todo o processo (mesmo padrão do ML). */
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
