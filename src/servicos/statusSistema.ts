import { obterBrowser } from "../integracoes/mercadoLivre/browserConexao.js";
import { obterBrowser as obterBrowserShopee } from "../integracoes/shopee/browserConexao.js";

// Reaproveita a conexão CDP única do processo (ver browserConexao.ts) em vez
// de abrir uma nova a cada checagem — chamar chromium.connectOverCDP() direto
// aqui, sem nunca fechar, era uma fonte de vazamento de memória toda vez que
// o painel/dashboard era recarregado.
export async function chromeConectado(): Promise<boolean> {
  try {
    return await Promise.race([
      obterBrowser().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
    ]);
  } catch {
    return false;
  }
}

export async function chromeShopeeConectado(): Promise<boolean> {
  try {
    return await Promise.race([
      obterBrowserShopee().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
    ]);
  } catch {
    return false;
  }
}
