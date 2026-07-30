export interface ProdutoCardDetectado {
  urlBruta: string;
  /** Linha inteira do post que menciona cupom, do jeito que foi escrita (ver extrairLinhaCupom). */
  cupom: string | null;
}

export interface PrecosExtraidos {
  precoOriginal: number | null;
  precoPromocional: number;
  noPix: boolean;
}

const REGEX_URL = /(https?:\/\/[^\s]+)/g;
// O formato da frase de cupom varia demais entre grupos ("cupom: X",
// "cupons: X ou Y", "cupom de XX% OFF X no anúncio", e provavelmente outros
// que ainda vão aparecer) — em vez de tentar estruturar só o CÓDIGO com
// regex (frágil, precisa de ajuste a cada formato novo — já corrigimos um
// bug de código minúsculo sendo capturado por engano, "cupom esgotando"),
// pega a linha inteira que menciona "cupom"/"cupons" e repassa ela do jeito
// que foi escrita na legenda enviada pro canal do usuário (ver
// gerarLegenda.ts). Decisão explícita do usuário.
const REGEX_LINHA_CUPOM = /cupo(?:m|ns)/i;
// "De: 886 | Por: R$372" ou "De R$599,99 por R$359,99" (sem "|", só espaço
// — outro formato real observado) ou só "Por: R$56" (sem original — post só
// destaca o preço final). O "|" é opcional de propósito. O grupo extra no
// fim captura o resto da linha, só pra checar se tem "pix" logo depois do
// valor (ver REGEX_PIX abaixo) — não entra no valor numérico.
const REGEX_PRECO_DE_POR = /De:?\s*R?\$?\s*([\d.,]+)\s*(?:\|\s*)?Por:?\s*R?\$?\s*([\d.,]+)([^\n]*)/i;
const REGEX_PRECO_POR = /Por:?\s*R?\$?\s*([\d.,]+)([^\n]*)/i;
// Último recurso: linha com "R$<valor>" solto, sem "De"/"Por" nenhum (ex.:
// "💵 R$ 77", "💵 R$ 645,21 no Pix") — formato real visto em post de grupo
// monitorado. Só considera linha que NÃO menciona cupom, pra não confundir
// com um valor de desconto tipo "cupom de R$40 OFF" (que também tem "R$").
const REGEX_PRECO_SOLTO = /R\$\s*([\d.,]+)([^\n]*)/i;
const REGEX_PIX = /pix/i;

function paraNumero(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", "."));
}

/** Pega a linha inteira que menciona cupom, do jeito que foi escrita (ver comentário em REGEX_LINHA_CUPOM). */
export function extrairLinhaCupom(texto: string): string | null {
  const linha = texto.split("\n").find((l) => REGEX_LINHA_CUPOM.test(l));
  return linha ? linha.trim() : null;
}

/**
 * Extrai o preço tal como anunciado no próprio post do grupo monitorado.
 * Pedido explícito do usuário: o produto deve ir pro disparo com o MESMO
 * valor que apareceu no grupo monitorado, não o preço atual (que pode ter
 * mudado) raspado da página do ML — só título e imagem continuam vindo da
 * página real (ver capturarProdutoTerceiro.ts e a nota em extrairProdutoCard
 * acima sobre não confiar na imagem do post).
 *
 * Também detecta quando o valor é condicionado a pagamento no Pix ("Por:
 * R$82 pix 👑", comum nesses grupos) — precisa aparecer na legenda enviada
 * pro canal do usuário, senão o preço mostrado passa a impressão errada de
 * valer em qualquer forma de pagamento (ver gerarLegenda.ts).
 */
export function extrairPrecos(texto: string): PrecosExtraidos | null {
  const matchDePor = texto.match(REGEX_PRECO_DE_POR);
  if (matchDePor) {
    return {
      precoOriginal: paraNumero(matchDePor[1]),
      precoPromocional: paraNumero(matchDePor[2]),
      noPix: REGEX_PIX.test(matchDePor[3]),
    };
  }

  const matchPor = texto.match(REGEX_PRECO_POR);
  if (matchPor) {
    return { precoOriginal: null, precoPromocional: paraNumero(matchPor[1]), noPix: REGEX_PIX.test(matchPor[2]) };
  }

  const linhaPrecoSolto = texto.split("\n").find((l) => REGEX_PRECO_SOLTO.test(l) && !REGEX_LINHA_CUPOM.test(l));
  const matchSolto = linhaPrecoSolto?.match(REGEX_PRECO_SOLTO);
  if (matchSolto) {
    return { precoOriginal: null, precoPromocional: paraNumero(matchSolto[1]), noPix: REGEX_PIX.test(matchSolto[2]) };
  }

  return null;
}

/**
 * Detecta se uma mensagem parece ser um "card de produto" (link de produto,
 * às vezes com cupom junto) — diferente do formato de lista de cupons
 * genéricos (ver parsearCupons.ts). Não tenta extrair título/preço/imagem
 * daqui: isso vem sempre da página real do produto (ver produtoScraper.ts),
 * nunca do texto do post — pode vir incompleto ou com imagem de outro canal.
 *
 * Só considera links que pareçam ser do Mercado Livre — pedido explícito do
 * usuário ("normalmente vem com meli no link"): não processar produto de
 * outro site, nem chegar a navegar no Chrome pra links de outra origem.
 * Cobre tanto o formato curto oficial (`meli.la/...`, o mesmo que o nosso
 * gerador produz) quanto o link direto do produto (`mercadolivre.com.br`
 * ou `mercadolibre.com`, que não contêm literalmente "meli" no domínio).
 */
export function extrairProdutoCard(texto: string): ProdutoCardDetectado | null {
  const urls = texto.match(REGEX_URL);
  if (!urls || urls.length === 0) return null;

  const urlMeli = urls.find((url) => {
    const urlBaixa = url.toLowerCase();
    return (
      urlBaixa.includes("meli") ||
      urlBaixa.includes("mercadolivre") ||
      urlBaixa.includes("mercadolibre")
    );
  });
  if (!urlMeli) return null;

  const urlBruta = urlMeli.replace(/[.,;!?)\]]+$/, "");

  return { urlBruta, cupom: extrairLinhaCupom(texto) };
}
