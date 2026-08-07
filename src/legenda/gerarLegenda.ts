import type { ParametrosLegenda } from "./tipos.js";

function formatarPreco(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Tira decoração que o post original já possa ter trazido (⚠️, *negrito*,
// marcador de lista) antes de aplicar a nossa própria — senão dobra emoji/
// asterisco quando o post de origem já vinha com eles.
function limparLinhaCupom(linha: string): string {
  return linha
    .replace(/^[\s\-•*_⚠️]+/u, "")
    .replace(/[\s*_⚠️]+$/u, "")
    .trim();
}

// Remove QUALQUER "*"/"_" que sobrar no MEIO do texto (não só nas pontas,
// ver limparLinhaCupom acima) — texto vindo de post de terceiro pode ter seu
// próprio *negrito*/_itálico_ interno, embutido no meio da frase (ex.:
// "*E TEM CUPOM...!* _detalhe aqui_"). Quando a gente embrulha esse texto de
// novo no NOSSO próprio "*...*", os asteriscos do meio ficam soltos/
// desbalanceados — bug real: Telegram (bem mais rígido que WhatsApp com
// entidade Markdown) recusa a mensagem inteira com "can't find end of the
// entity". Mais seguro tirar todo "*"/"_" de texto de terceiro do que tentar
// preservar negrito aninhado sem quebrar o balanceamento.
function semMarkdown(texto: string): string {
  return texto.replace(/[*_]/g, "");
}

// NaN tecnicamente é um "number" pro TypeScript, então o tipo de
// ParametrosLegenda não pega isso — sem essa checagem, um NaN vazando de
// algum bug de extração de preço (já visto um caso real) vira "R$ NaN" na
// legenda enviada de verdade pro cliente. Trata como "sem esse preço" em vez
// de deixar passar.
function precoValido(valor: number | undefined): number | undefined {
  return valor !== undefined && !Number.isNaN(valor) ? valor : undefined;
}

// *negrito* funciona tanto no WhatsApp quanto no Telegram (modo Markdown legado).
export function gerarLegenda(p: ParametrosLegenda): string {
  const linhas: string[] = [];
  const precoOriginal = precoValido(p.precoOriginal);
  const precoPromocional = precoValido(p.precoPromocional);

  if (p.chamada) {
    linhas.push(semMarkdown(p.chamada), "");
  }

  linhas.push(`*${semMarkdown(p.titulo)}*`, "");

  const temDesconto = precoOriginal !== undefined && precoPromocional !== undefined && precoOriginal > precoPromocional;

  const sufixoPix = p.precoNoPix ? " no Pix 💠" : "";

  if (temDesconto) {
    linhas.push(`De: ${formatarPreco(precoOriginal!)} | Por: ${formatarPreco(precoPromocional!)}${sufixoPix} 🔥`);
  } else {
    const preco = precoPromocional ?? precoOriginal;
    if (preco !== undefined) linhas.push(`Por: ${formatarPreco(preco)}${sufixoPix}`);
  }

  // `p.cupom` já vem como a linha inteira do post original que menciona
  // cupom (ver extrairProdutoCard em parsearProdutoCard.ts) — repassa o
  // conteúdo sem reformatar (o formato varia demais entre grupos pra tentar
  // estruturar só um código), mas sempre em negrito com ⚠️, pra destacar.
  if (p.cupom) {
    linhas.push(`⚠️ *${semMarkdown(limparLinhaCupom(p.cupom))}*`);
    // Link de ATIVAR o cupom no anúncio, distinto do link de afiliado do
    // produto (ver ProdutoRow.linkCupom) — sem ele, a legenda menciona
    // "resgate o cupom" mas não dá pro cliente clicar em lugar nenhum pra
    // ativar (bug real reportado pelo usuário).
    if (p.linkCupom) linhas.push(p.linkCupom);
  }

  linhas.push("", `Link: ${p.linkAfiliado}`);

  return linhas.join("\n");
}
