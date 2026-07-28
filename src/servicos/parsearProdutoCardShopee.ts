import { extrairLinhaCupom, extrairPrecos, type PrecosExtraidos } from "./parsearProdutoCard.js";

export interface ProdutoCardShopeeDetectado {
  urlBruta: string;
  titulo: string | null;
  cupom: string | null;
  precos: PrecosExtraidos | null;
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

/**
 * Diferente do Mercado Livre: não temos como raspar a página real do produto
 * (site bloqueia automação, ver PROJECT_STATUS.md) nem uma API de dados de
 * produto (a API oficial da Shopee só gera link de afiliado). Por decisão
 * do usuário, título e preço vêm do próprio texto do post aqui — só a
 * geração do link é oficial (via API).
 *
 * Heurística do título: primeira linha não vazia, pulando a primeira linha
 * da mensagem (geralmente é uma "chamada" de marketing, não o nome do
 * produto — ver exemplos reais no Mercado Livre, mesmo estilo de grupo) e
 * qualquer linha de preço/cupom/link — com emoji/símbolos do início
 * removidos.
 */
function extrairTitulo(texto: string, precos: PrecosExtraidos | null, cupom: string | null): string | null {
  const linhas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i];
    if (/^https?:\/\//i.test(linha)) continue;
    if (cupom && linha === cupom) continue;
    if (precos && (linha.includes(String(precos.precoPromocional)) || /R\$|reais?/i.test(linha))) continue;

    const semSimbolos = linha.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (semSimbolos.length >= 5) return semSimbolos;
  }

  return null;
}

export function extrairProdutoCardShopee(texto: string): ProdutoCardShopeeDetectado | null {
  const urls = texto.match(REGEX_URL);
  if (!urls || urls.length === 0) return null;

  const urlShopee = urls.find(ehUrlShopee);
  if (!urlShopee) return null;

  const urlBruta = urlShopee.replace(/[.,;!?)\]]+$/, "");
  const cupom = extrairLinhaCupom(texto);
  const precos = extrairPrecos(texto);
  const titulo = extrairTitulo(texto, precos, cupom);

  return { urlBruta, titulo, cupom, precos };
}
