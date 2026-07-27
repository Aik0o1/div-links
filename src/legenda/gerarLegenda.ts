import type { ParametrosLegenda } from "./tipos.js";

function formatarPreco(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

  if (p.cupom) {
    linhas.push(`⚠️ cupom: ${p.cupom}`);
  }

  linhas.push("", `Link: ${p.linkAfiliado}`);

  return linhas.join("\n");
}
