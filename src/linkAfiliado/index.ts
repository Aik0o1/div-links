import { linkMercadoLivre } from "./linkMercadoLivre.js";
import type { GeradorDeLinkAfiliado } from "./tipos.js";

const geradores: Record<string, GeradorDeLinkAfiliado> = {
  [linkMercadoLivre.plataforma]: linkMercadoLivre,
};

export function gerarLinkAfiliado(
  plataforma: string,
  urlProduto: string,
): Promise<string> {
  const gerador = geradores[plataforma];
  if (!gerador) {
    throw new Error(`Nenhum gerador de link de afiliado para "${plataforma}"`);
  }
  return gerador.gerar(urlProduto);
}

export type { GeradorDeLinkAfiliado } from "./tipos.js";
