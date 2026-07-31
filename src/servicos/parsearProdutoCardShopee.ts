import {
  extrairLinhaCupom,
  extrairChamada,
  extrairPrecos,
  mencionaCupom,
  ehMencaoSolta,
  chamadaSemRepetirTitulo,
  type PrecosExtraidos,
} from "./parsearProdutoCard.js";

export interface ProdutoCardShopeeDetectado {
  urlBruta: string;
  titulo: string | null;
  cupom: string | null;
  /** Link de ativação do cupom no anúncio — distinto do link do produto, ver classificarUrlsShopee. Null quando só há 1 link (nada a diferenciar). */
  linkCupom: string | null;
  precos: PrecosExtraidos | null;
  /** Texto de chamada/impacto do post original, ver extrairChamada em parsearProdutoCard.ts. */
  chamada: string | null;
}

const REGEX_URL = /(https?:\/\/[^\s]+)/g;

/**
 * Detecta link de produto da Shopee num post de grupo monitorado (mesmos
 * grupos usados pro Mercado Livre — às vezes tem promoção de um, às vezes
 * do outro). Cobre o link direto (`shopee.com.br/...`) e os encurtadores
 * oficiais (`s.shopee.com.br`, `shope.ee`).
 */
function ehUrlShopee(url: string): boolean {
  const urlBaixa = url.toLowerCase();
  return urlBaixa.includes("shopee.com") || urlBaixa.includes("shope.ee");
}

/** Uma linha inteira que é só uma tag de divulgação ("#publi", "#ad", "#publicidade") — nunca é o título, mesmo passando pelos outros filtros. */
function ehTagDivulgacao(linha: string): boolean {
  return /^#\S+$/.test(linha);
}

function candidatoTitulo(linhas: string[], inicio: number, precos: PrecosExtraidos | null): string | null {
  for (let i = inicio; i < linhas.length; i++) {
    const linha = linhas[i];
    // Sem "^" de propósito: o link real quase sempre vem prefixado com um
    // emoji ("🔗 https://...", "➡️ https://..."), então ancorar no início da
    // linha deixava passar e a URL virava "título" por engano.
    if (/https?:\/\//i.test(linha)) continue;
    // Qualquer linha que mencione cupom, não só a escolhida como "a linha do
    // cupom" — post real teve VÁRIAS linhas mencionando cupom (chamada de
    // marketing, aviso de região, passo do resgate, passo do pagamento) e só
    // excluir a exata escolhida deixava as outras virarem título por engano.
    if (mencionaCupom(linha)) continue;
    if (ehTagDivulgacao(linha)) continue;
    if (ehMencaoSolta(linha)) continue;
    if (precos && (linha.includes(String(precos.precoPromocional)) || /R\$|reais?/i.test(linha))) continue;

    const semSimbolos = linha.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (semSimbolos.length >= 5) return semSimbolos;
  }

  return null;
}

/**
 * Diferente do Mercado Livre: não temos como raspar a página real do produto
 * (site bloqueia automação, ver PROJECT_STATUS.md) nem uma API de dados de
 * produto (a API oficial da Shopee só gera link de afiliado). Por decisão
 * do usuário, título e preço vêm do próprio texto do post aqui — só a
 * geração do link é oficial (via API).
 *
 * Heurística do título: primeira linha não vazia depois do bloco de chamada
 * (ver extrairChamada — pode ser 0, 1 ou várias linhas) e qualquer linha de
 * preço/cupom/link/tag de divulgação/marca d'água — com emoji/símbolos do
 * início removidos. Quando isso não acha NADA (post real sem chamada
 * separada — a primeira linha já É o título, ex.: "🔥 Veda Porta... \n\n Por
 * R$12,99 \n link \n #publi"), tenta de novo incluindo o bloco de chamada —
 * sem esse fallback, a busca caía direto no "#publi" (única linha "sobrando"
 * depois de excluir preço/link) como se fosse o título.
 */
function extrairTitulo(texto: string, precos: PrecosExtraidos | null, chamada: string | null): string | null {
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const inicio = chamada ? chamada.split("\n").length : 0;
  return candidatoTitulo(linhas, inicio, precos) ?? candidatoTitulo(linhas, 0, precos);
}

/**
 * Qual dos (até 2) links da Shopee é o do PRODUTO (vira link de afiliado) e
 * qual é o de ATIVAR O CUPOM no anúncio (só repassado como veio, nunca vira
 * afiliado — ver comentário em ProdutoCardShopeeDetectado.linkCupom).
 *
 * A posição (primeiro/último) NÃO é confiável — grupos diferentes invertem:
 * num exemplo real o de cima era o cupom e o de baixo o produto, noutro
 * (real também) era o oposto (produto em cima, cupom embaixo). O que É
 * confiável é o CONTEXTO: o link de cupom sempre tem "resgat"/"cupom" na
 * própria linha ou na linha logo acima (ex.: "resgate e aplique o cupom...
 * clique aqui\nhttps://..."). Só cai no chute antigo (cima=cupom,
 * baixo=produto) quando não dá pra classificar nenhum dos dois assim (ou os
 * dois, ou nenhum, parecem de cupom) — mantém alguma resposta em vez de
 * travar.
 */
function classificarUrlsShopee(texto: string, urlsShopee: string[]): { produto: string; cupom: string | null } {
  if (urlsShopee.length === 1) return { produto: urlsShopee[0], cupom: null };

  const linhas = texto.split("\n");
  const pareceLinkDeCupom = (url: string): boolean => {
    const idx = linhas.findIndex((l) => l.includes(url));
    if (idx === -1) return false;
    const linhaAtual = linhas[idx];
    const linhaAnterior = linhas[idx - 1] ?? "";
    return (
      mencionaCupom(linhaAtual) || mencionaCupom(linhaAnterior) || /resgat/i.test(linhaAtual) || /resgat/i.test(linhaAnterior)
    );
  };

  const candidatosCupom = urlsShopee.filter(pareceLinkDeCupom);
  const candidatosProduto = urlsShopee.filter((u) => !candidatosCupom.includes(u));

  if (candidatosCupom.length > 0 && candidatosProduto.length > 0) {
    return {
      produto: candidatosProduto[candidatosProduto.length - 1],
      cupom: candidatosCupom[0],
    };
  }

  // Não deu pra classificar por contexto (nenhum ou os dois pareciam cupom) —
  // último recurso: assume o padrão mais comum visto até agora (cima=cupom, baixo=produto).
  return { produto: urlsShopee[urlsShopee.length - 1], cupom: urlsShopee[0] };
}

export function extrairProdutoCardShopee(texto: string): ProdutoCardShopeeDetectado | null {
  const urls = texto.match(REGEX_URL);
  if (!urls || urls.length === 0) return null;

  const urlsShopee = urls.filter(ehUrlShopee);
  if (urlsShopee.length === 0) return null;

  const { produto, cupom: linkCupomBruto } = classificarUrlsShopee(texto, urlsShopee);
  const urlBruta = produto.replace(/[.,;!?)\]]+$/, "");
  // Guarda o link de ativação do cupom também (quando existe) — sem ele, a
  // legenda menciona "resgate o cupom" mas não dá pro cliente clicar em
  // lugar nenhum pra ativar (bug real reportado pelo usuário). Não vira
  // link de afiliado (não é o produto), repassado como veio no post.
  const linkCupom = linkCupomBruto ? linkCupomBruto.replace(/[.,;!?)\]]+$/, "") : null;

  const cupom = extrairLinhaCupom(texto);
  const precos = extrairPrecos(texto);
  const chamadaBruta = extrairChamada(texto);
  const titulo = extrairTitulo(texto, precos, chamadaBruta);
  // Post sem chamada separada (a "chamada" extraída é, na prática, a própria
  // primeira linha que também virou título) — não repete a mesma frase duas
  // vezes na legenda (ver extrairTitulo, fallback que inclui o bloco de
  // chamada quando não acha título em nenhum outro lugar; ver
  // chamadaSemRepetirTitulo pro mesmo problema do lado do Mercado Livre).
  const chamada = chamadaSemRepetirTitulo(chamadaBruta, titulo);

  return { urlBruta, titulo, cupom, linkCupom, precos, chamada };
}
