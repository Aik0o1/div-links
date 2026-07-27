import { abrirPaginaEmBackground } from "./paginaBackground.js";
import { obterBrowser } from "./browserConexao.js";

const LINKBUILDER_URL = "https://www.mercadolivre.com.br/afiliados/linkbuilder#hub";

export async function gerarLinkViaLinkBuilder(urlProduto: string): Promise<string> {
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
