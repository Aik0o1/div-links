import { abrirPaginaEmBackground } from "./paginaBackground.js";
import { obterBrowser } from "./browserConexao.js";

const LINKBUILDER_URL = "https://www.mercadolivre.com.br/afiliados/linkbuilder#hub";

// Fila que serializa as chamadas — a automação usa UMA ÚNICA aba/textarea
// compartilhada (ver `pagina` abaixo), então duas chamadas "ao mesmo tempo"
// (ex.: disparo automático + disparo manual, ou dois disparos automáticos
// pra canais diferentes no mesmo tick) competiam pelo mesmo textarea: uma
// preenchia com a URL do produto A, a outra sobrescrevia com a URL do
// produto B antes da primeira ler o resultado — cada uma podia acabar lendo
// o link gerado PRO PRODUTO ERRADO. Bug real, confirmado em produção: pelo
// menos 3 produtos diferentes (perfume, cadeira, casinha de gato) saíram
// com o link de afiliado de OUTRO produto completamente diferente. Como o
// link fica em cache no Redis sem expiração (ver linkAfiliado/cache.ts), o
// erro persistia mesmo em disparos muito mais tarde. Encadear em `filaAtual`
// garante que só uma geração usa o textarea compartilhado por vez, não
// importa de onde a chamada partiu.
let filaAtual: Promise<unknown> = Promise.resolve();

export function gerarLinkViaLinkBuilder(urlProduto: string): Promise<string> {
  const minhaVez = filaAtual.then(() => gerarLinkViaLinkBuilderSemFila(urlProduto));
  // Não deixa uma falha travar a fila pras chamadas seguintes — cada uma
  // trata seu próprio erro (ver .catch nos usos de gerarLinkAfiliado).
  filaAtual = minhaVez.catch(() => {});
  return minhaVez;
}

async function gerarLinkViaLinkBuilderSemFila(urlProduto: string): Promise<string> {
  const browser = await obterBrowser();
  const contexto = browser.contexts()[0];
  const pagina = contexto.pages()[0] ?? (await abrirPaginaEmBackground(browser));

  if (!pagina.url().startsWith("https://www.mercadolivre.com.br/afiliados/linkbuilder")) {
    await pagina.goto(LINKBUILDER_URL, { waitUntil: "networkidle" });
  }

  const textareaResultado = pagina.locator(
    'textarea[aria-label="Copie o link e comece a compartilhá-lo"]',
  );
  const valorAnterior = (await textareaResultado.inputValue().catch(() => "")) ?? "";

  const textareaEntrada = pagina.locator("textarea").first();
  await textareaEntrada.fill(urlProduto);

  const botaoGerar = pagina.locator("button", { hasText: /^gerar$/i });
  await botaoGerar.click();

  const handle = await textareaResultado.elementHandle();
  await pagina.waitForFunction(
    ({ el, anterior }: any) => el.value && el.value !== anterior,
    { el: handle, anterior: valorAnterior },
    { timeout: 15000 },
  );

  const resultado = await textareaResultado.inputValue();

  if (!resultado.includes("meli.la")) {
    throw new Error(`Mercado Livre recusou a URL "${urlProduto}": ${resultado}`);
  }

  return resultado;
}
