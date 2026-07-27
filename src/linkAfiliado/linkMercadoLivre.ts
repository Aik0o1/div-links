import { gerarLinkViaLinkBuilder } from "../integracoes/mercadoLivre/linkBuilderAutomatizado.js";
import { comCache } from "./cache.js";
import type { GeradorDeLinkAfiliado } from "./tipos.js";

const geradorBase: GeradorDeLinkAfiliado = {
  plataforma: "mercado_livre",
  gerar: gerarLinkViaLinkBuilder,
};

export const linkMercadoLivre = comCache(geradorBase);
