export interface ProdutoCardDetectado {
  urlBruta: string;
  /** Linha inteira do post que menciona cupom, do jeito que foi escrita (ver extrairLinhaCupom). */
  cupom: string | null;
  /** Texto de chamada/impacto do início do post, do jeito que foi escrito (ver extrairChamada). */
  chamada: string | null;
}

export interface PrecosExtraidos {
  precoOriginal: number | null;
  precoPromocional: number;
  noPix: boolean;
}

// "De:" mais de 10x o "Por:" (>90% de desconto implícito) é chute de
// marketing pra inflar o desconto aparente, não preço real — nenhuma
// promoção legítima de marketplace chega perto disso. Bug real
// (2026-08-15): grupo monitorado postou "De: R$16.000,00 | Por: R$144,00"
// pra um aspirador de pó portátil comum — o valor "De:" nunca existiu.
// Mesmo espírito da correção do lado do Mercado Livre (2026-08-10, "De:
// R$600" pra produto que nunca custou isso — ver capturarProdutoTerceiro.ts)
// — lá dá pra confirmar contra a página real raspada; aqui (usado também
// pela Shopee, que não dá pra raspar, ver capturarProdutoShopee.ts) só dá
// pra aplicar um teste de plausibilidade. Descarta só o "De:" implausível
// (produto ainda é capturado e disparado, só sem preço original/desconto
// riscado) — nunca descarta o produto inteiro por causa disso.
const RAZAO_MAXIMA_DESCONTO_PLAUSIVEL = 10;
function precoOriginalPlausivel(precoOriginal: number, precoPromocional: number): boolean {
  return precoOriginal <= precoPromocional * RAZAO_MAXIMA_DESCONTO_PLAUSIVEL;
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
// Quando VÁRIAS linhas mencionam "cupom" no mesmo post (chamada de
// marketing tipo "CHEGOU CUPOMMM...", aviso de "cupom válido só pra algumas
// regiões", a linha real de resgate, e até um passo de "selecione o Cupom de
// Desconto no pagamento" — tudo no mesmo post real) — pegar a PRIMEIRA que
// bate é frágil. "Resgate...cupom" juntos na mesma linha é o padrão real
// mais específico (todo exemplo já visto de cupom de verdade usa essa
// frase), então tenta essa primeiro antes de cair pro "primeira linha que
// menciona cupom" de sempre.
const REGEX_LINHA_RESGATE_CUPOM = /resgate.*cupo(?:m|ns)/i;
// Segunda prioridade, mesmo motivo do resgate acima — outro post real usa
// "Digite o código em 'cupons' no carrinho: CODE" em vez de "resgate", mas
// também é bem mais específico que qualquer menção solta de "cupom" (ex.:
// a chamada de marketing "CHEGOU CUPOM NO MELI!!!", que não é a linha
// certa).
const REGEX_LINHA_CODIGO_CUPOM = /c[oó]digo.*cupo(?:m|ns)|cupo(?:m|ns).*c[oó]digo/i;
// "De: 886 | Por: R$372", "De R$599,99 por R$359,99" (sem "|", só espaço),
// "De _ R$ 206,05 _ / Agora por apenas R$ 108,79" (marcação de itálico com
// "_" em volta do valor, "De" e "Por" em linhas separadas, e "apenas" entre
// "por" e o valor) — todos formatos reais observados. Entre "De" e seu valor
// (e entre "Por" e o seu) aceita QUALQUER texto curto que não seja dígito
// (não só espaço/"R$"/":") — cobre itálico/negrito, "apenas"/"só", etc. sem
// precisar listar cada variação. Entre o valor de "De" e a palavra "Por"
// pode ter texto/quebra de linha maior (ex.: emoji + linha nova antes de
// "Agora por..."), por isso o limite é mais largo ali; já entre "Por" e seu
// próprio valor fica restrito à mesma linha, pra não pular pra um número
// errado mais adiante no texto. Só "Por: R$56" (sem original) também é
// coberto por REGEX_PRECO_POR sozinho quando o post não destaca preço de
// antes.
// `\b` (borda de palavra) é essencial aqui — sem isso "De"/"Por" batem
// dentro de qualquer palavra que contenha essas letras juntas (ex.:
// "biodegradável" tem "de" embutido, "suporte"/"esporte" têm "por"
// embutido) — bug real: pegou "4" de "Biodegradável 4 Kg" como se fosse o
// preço "De", ignorando o valor de verdade mais abaixo no texto.
// "Po+r" (não só "Por") — mesmo estilo de letra repetida pra ênfase já visto
// em "CUPOMMM"/"INDICOOO" em outros posts reais, aqui vira "Poor" por
// engano/estilo ("🔥Poor: 26,88") — sem isso, nenhum preço é reconhecido.
//
// `(?![A-Za-zÀ-ÿ])` logo depois do valor capturado (nas três regex abaixo):
// bug real (2026-08-15) — "\bDe\b" bate na preposição "de" comum no meio de
// qualquer frase (não só no rótulo de preço "De:"), e "sucção forte de
// 16000Pa" tinha um número (a especificação de pressão do produto, "16000",
// colado direto em "Pa") logo depois dessa palavra "de" — virou um "De:
// R$16.000" fantasma, nunca escrito no post. Preço de verdade nunca vem
// colado numa unidade/palavra sem espaço nenhum ("16000Pa", "500W",
// "2kg") — exigir que NADA de letra venha grudada direto no valor descarta
// esse tipo de falso positivo sem quebrar nenhum formato real documentado
// acima (todos têm separador — "|", quebra de linha, "R$", etc. — entre o
// valor e o que vem depois).
const REGEX_PRECO_DE_POR =
  /\bDe\b[^\d\n]{0,15}?([\d.,]+)(?![A-Za-zÀ-ÿ])[\s\S]{0,60}?\bPo+r\b[^\d\n]{0,20}?([\d.,]+)(?![A-Za-zÀ-ÿ])([^\n]*)/i;
const REGEX_PRECO_POR = /\bPo+r\b[^\d\n]{0,20}?([\d.,]+)(?![A-Za-zÀ-ÿ])([^\n]*)/i;
// Último recurso: linha com "R$<valor>" solto, sem "De"/"Por" nenhum (ex.:
// "💵 R$ 77", "💵 R$ 645,21 no Pix") — formato real visto em post de grupo
// monitorado. Só considera linha que NÃO menciona cupom, pra não confundir
// com um valor de desconto tipo "cupom de R$40 OFF" (que também tem "R$").
const REGEX_PRECO_SOLTO = /R\$\s*([\d.,]+)(?![A-Za-zÀ-ÿ])([^\n]*)/i;
const REGEX_PIX = /pix/i;
// "Por: R$136,44 (ou R$109,15 no pix!!!)" — formato real visto: o valor
// logo depois de "Por" é o preço "normal" (cartão), e o de pix (mais barato)
// vem entre parênteses no MESMO resto de linha que só checávamos pra saber
// SE tinha "pix" (sem nunca olhar o valor ali). Sem isso, mostrava "Por:
// R$136,44 no Pix" — valor errado (o de pix de verdade era R$109,15).
const REGEX_PIX_VALOR_ALTERNATIVO = /R\$\s*([\d.,]+)[^\n]*?pix/i;

function paraNumero(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", "."));
}

/** Quando o resto da linha do "Por" tem um valor de pix alternativo mais específico, prefere ele (ver REGEX_PIX_VALOR_ALTERNATIVO). */
function precoFinalDaLinhaPor(valorTexto: string, resto: string): { valor: number; noPix: boolean } {
  const matchAlternativo = resto.match(REGEX_PIX_VALOR_ALTERNATIVO);
  if (matchAlternativo) return { valor: paraNumero(matchAlternativo[1]), noPix: true };
  return { valor: paraNumero(valorTexto), noPix: REGEX_PIX.test(resto) };
}

/** Pega a linha inteira que menciona cupom, do jeito que foi escrita (ver comentário em REGEX_LINHA_CUPOM/REGEX_LINHA_RESGATE_CUPOM). */
export function extrairLinhaCupom(texto: string): string | null {
  const linhas = texto.split("\n");
  const linha =
    linhas.find((l) => REGEX_LINHA_RESGATE_CUPOM.test(l)) ??
    linhas.find((l) => REGEX_LINHA_CODIGO_CUPOM.test(l)) ??
    linhas.find((l) => REGEX_LINHA_CUPOM.test(l));
  if (!linha) return null;
  // A linha de resgate às vezes já vem com o link de ativação embutido
  // ("...aqui: https://..."), que a legenda mostra separado (ver
  // ProdutoRow.linkCupom) — sem tirar daqui, o link aparecia duas vezes.
  return linha.replace(/https?:\/\/\S+/gi, "").trim();
}

/** Qualquer linha que mencione cupom (não só a escolhida por extrairLinhaCupom) — usado pra excluir da busca de título, ver extrairTitulo em parsearProdutoCardShopee.ts. */
export function mencionaCupom(linha: string): boolean {
  return REGEX_LINHA_CUPOM.test(linha);
}

/** Linha que é só uma menção "@usuário" (marca d'água de quem postou, ex.: "@taciaeosgatos") — nunca é título nem chamada. */
export function ehMencaoSolta(linha: string): boolean {
  return /^@\S+$/.test(linha);
}

// Grupo "Lobão das Promoções" assina as chamadas com variações do próprio
// mascote/marca ("lobo", "loba", "lobos", "lobas", "lobinho", "lobinha",
// "lobão"...) — é auto-referência do grupo, não impacto sobre o produto.
// Pedido explícito do usuário: essas linhas não devem virar chamada.
const REGEX_MARCA_LOBO = /\blob(?:o|a|ão|ões|os|as|inhos?|inhas?)\b/i;

/** Linha que menciona o mascote/marca "lobo" (grupo Lobão das Promoções) — auto-referência do grupo, nunca vira chamada. */
export function mencionaMarcaLobo(linha: string): boolean {
  return REGEX_MARCA_LOBO.test(linha);
}

/**
 * Pega o(s) texto(s) de "chamada" de impacto do começo do post (ex.: "🌟O
 * BRINQUEDO QUE DEIXOU MEUS 12 GATOS MAAAALUCOSSS!" + "Impossivel seu gato
 * não gostar!"), repassados do jeito que foram escritos — pedido explícito
 * do usuário, quer essa energia/estilo do grupo aparecendo na legenda em vez
 * de sempre depender da chamada gerada por IA (ver dispararProduto.ts, que
 * só gera por IA quando o produto NÃO já tem uma).
 *
 * Acumula linhas do início enquanto forem "hook" de verdade — para na
 * primeira linha vazia, que menciona cupom (aviso de "cupom válido só pra
 * algumas regiões" não é chamada) ou que é só uma marca d'água tipo
 * "@usuário". Sem achar nenhuma linha (post começa direto com o cupom, ou a
 * primeira linha já falha algum desses critérios), não tem chamada — não é
 * erro, é normal.
 *
 * Linha que menciona a marca "lobo" (ver REGEX_MARCA_LOBO) é só PULADA, não
 * interrompe a busca — é auto-referência do grupo em meio ao resto da
 * chamada de verdade, as linhas ao redor continuam válidas.
 */
export function extrairChamada(texto: string): string | null {
  const linhas = texto.split("\n").map((l) => l.trim());
  const chamada: string[] = [];

  for (const linha of linhas) {
    if (!linha || mencionaCupom(linha) || ehMencaoSolta(linha)) break;
    if (mencionaMarcaLobo(linha)) continue;
    chamada.push(linha);
  }

  return chamada.length > 0 ? chamada.join("\n") : null;
}

function semSimbolosDasPontas(texto: string): string {
  return texto.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();
}

function tokenizarSemAcento(texto: string): string[] {
  return (
    texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // remove acentos (marcas de combinação após normalize NFD)
      .match(/[a-z0-9]{3,}/g) ?? []
  );
}

/**
 * Quando o post simplesmente copia (às vezes abreviando/reescrevendo um
 * pouco — bug real: "Cadeira Ergonômica Mônaco..." na chamada x "Cadeira DE
 * ESCRITÓRIO Ergonômica Mônaco..." no título de verdade, não bate igual) o
 * próprio título do produto como se fosse a "chamada" (às vezes seguido de
 * uma tag automática tipo "Vendido no Mercado Livre"), isso NÃO é uma frase
 * de impacto de verdade — é só o título duplicado. Bug real: legenda
 * mostrando o título 2x (uma vez como "chamada", outra como o `*título*` de
 * sempre). Em vez de exigir a primeira linha da chamada IDÊNTICA ao título,
 * compara por sobreposição de palavras (>=70% das palavras da primeira
 * linha também aparecem no título) — se bater, descarta a chamada inteira
 * (não só aquela linha), já que o resto que sobrar tende a ser só uma tag
 * genérica tipo a do Mercado Livre acima, não uma chamada de verdade sozinha.
 */
export function chamadaSemRepetirTitulo(chamada: string | null, titulo: string | null): string | null {
  if (!chamada || !titulo) return chamada;

  const primeiraLinha = chamada.split("\n")[0];
  if (semSimbolosDasPontas(primeiraLinha).toLowerCase() === semSimbolosDasPontas(titulo).toLowerCase()) return null;

  const tokensLinha = tokenizarSemAcento(primeiraLinha);
  if (tokensLinha.length === 0) return chamada;
  const tokensTitulo = new Set(tokenizarSemAcento(titulo));
  const emComum = tokensLinha.filter((t) => tokensTitulo.has(t)).length;

  return emComum / tokensLinha.length >= 0.7 ? null : chamada;
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
    const { valor, noPix } = precoFinalDaLinhaPor(matchDePor[2], matchDePor[3]);
    const precoOriginal = paraNumero(matchDePor[1]);
    return {
      precoOriginal: precoOriginalPlausivel(precoOriginal, valor) ? precoOriginal : null,
      precoPromocional: valor,
      noPix,
    };
  }

  const matchPor = texto.match(REGEX_PRECO_POR);
  if (matchPor) {
    const { valor, noPix } = precoFinalDaLinhaPor(matchPor[1], matchPor[2]);
    return { precoOriginal: null, precoPromocional: valor, noPix };
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

  return { urlBruta, cupom: extrairLinhaCupom(texto), chamada: extrairChamada(texto) };
}
