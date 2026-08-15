import { linkMercadoLivre } from "./linkMercadoLivre.js";
import { linkShopee } from "./linkShopee.js";
import type { GeradorDeLinkAfiliado } from "./tipos.js";

const geradores: Record<string, GeradorDeLinkAfiliado> = {
  [linkMercadoLivre.plataforma]: linkMercadoLivre,
  [linkShopee.plataforma]: linkShopee,
};

export function gerarLinkAfiliado(
  usuarioId: number,
  plataforma: string,
  urlProduto: string,
): Promise<string> {
  const gerador = geradores[plataforma];
  if (!gerador) {
    throw new Error(`Nenhum gerador de link de afiliado para "${plataforma}"`);
  }
  return gerador.gerar(usuarioId, urlProduto);
}

export type { GeradorDeLinkAfiliado } from "./tipos.js";
