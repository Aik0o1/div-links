import { gerarLinkAfiliado } from "../integracoes/shopee/api.js";
import { comCache } from "./cache.js";
import type { GeradorDeLinkAfiliado } from "./tipos.js";

const geradorBase: GeradorDeLinkAfiliado = {
  plataforma: "shopee",
  gerar: gerarLinkAfiliado,
};

export const linkShopee = comCache(geradorBase);
