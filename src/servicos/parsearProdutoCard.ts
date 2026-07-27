export interface ProdutoCardDetectado {
  urlBruta: string;
  cupom: string | null;
}

export interface PrecosExtraidos {
  precoOriginal: number | null;
  precoPromocional: number;
  noPix: boolean;
}

const REGEX_URL = /(https?:\/\/[^\s]+)/g;
// Aceita singular ("cupom: X") e plural ("cupons: X ou Y") — plural em
// português troca o "m" por "ns", não é só acrescentar "s". No plural, com
// mais de um código válido pro mesmo produto, pega só o primeiro (schema só
// guarda um cupom por produto hoje). O rótulo "cupom"/"cupons" aceita
// qualquer caixa, mas o CÓDIGO em si tem que ser maiúsculo — nos exemplos
// reais o código sempre vem em CAPS (FASHION, MODACOMVC, PRASUACASA...).
// Sem essa exigência, uma frase solta tipo "cupom esgotando" (aviso comum
// nesses grupos, não é o código) era capturada como se "esgotando" fosse o
// cupom; sem /i no fim, o texto continua a busca até achar o código de
// verdade mais adiante na mensagem (ex.: "⚠️ cupom: FASHION").
const REGEX_CUPOM = /(?:[Cc]upo(?:m|ns)|CUPO(?:M|NS)):?\s*([A-Z0-9]{3,20})/;
// "De: 886 | Por: R$372" (preço original + promocional) ou só "Por: R$56"
// (sem original — post só destaca o preço final). O grupo extra no fim
// captura o resto da linha, só pra checar se tem "pix" logo depois do valor
// (ver REGEX_PIX abaixo) — não entra no valor numérico.
const REGEX_PRECO_DE_POR = /De:?\s*R?\$?\s*([\d.,]+)\s*\|\s*Por:?\s*R?\$?\s*([\d.,]+)([^\n]*)/i;
const REGEX_PRECO_POR = /Por:?\s*R?\$?\s*([\d.,]+)([^\n]*)/i;
const REGEX_PIX = /pix/i;

function paraNumero(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", "."));
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

  const matchCupom = texto.match(REGEX_CUPOM);
  const cupom = matchCupom ? matchCupom[1] : null;

  return { urlBruta, cupom };
}
