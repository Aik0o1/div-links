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

// *negrito* funciona tanto no WhatsApp quanto no Telegram (modo Markdown legado).
export function gerarLegenda(p: ParametrosLegenda): string {
  const linhas: string[] = [];

  if (p.chamada) {
    linhas.push(p.chamada, "");
  }

  linhas.push(`*${p.titulo}*`, "");

  const temDesconto =
    p.precoOriginal !== undefined &&
    p.precoPromocional !== undefined &&
    p.precoOriginal > p.precoPromocional;

  const sufixoPix = p.precoNoPix ? " no Pix 💠" : "";

  if (temDesconto) {
    linhas.push(
      `De: ${formatarPreco(p.precoOriginal!)} | Por: ${formatarPreco(p.precoPromocional!)}${sufixoPix} 🔥`,
    );
  } else {
    const preco = p.precoPromocional ?? p.precoOriginal;
    if (preco !== undefined) linhas.push(`Por: ${formatarPreco(preco)}${sufixoPix}`);
  }

  // `p.cupom` já vem como a linha inteira do post original que menciona
  // cupom (ver extrairProdutoCard em parsearProdutoCard.ts) — repassa o
  // conteúdo sem reformatar (o formato varia demais entre grupos pra tentar
  // estruturar só um código), mas sempre em negrito com ⚠️, pra destacar.
  if (p.cupom) {
    linhas.push(`⚠️ *${limparLinhaCupom(p.cupom)}*`);
  }

  linhas.push("", `Link: ${p.linkAfiliado}`);

  return linhas.join("\n");
}
