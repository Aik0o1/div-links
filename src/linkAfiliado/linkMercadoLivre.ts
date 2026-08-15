import { criarLinkOficial } from "../integracoes/mercadoLivre/meliHttp.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import { comCache } from "./cache.js";
import type { GeradorDeLinkAfiliado } from "./tipos.js";

// 2026-08-13: trocado do Chrome (linkBuilderAutomatizado.ts) pro link direto
// (linkDireto.ts, matt_word/matt_tool na URL do produto) — sem Chrome, mas
// sem passar pelo redirect oficial do ML.
// 2026-08-14: o link direto saiu sem contar comissão em produção (relatado
// pelo usuário, produto chegou com o link "sem ser de afiliado"). Trocado
// pro link CURTO oficial (`meli.la/...`) de novo — mesmo resultado de
// sempre, só que gerado via HTTP puro (cookie + token CSRF, ver
// criarLinkOficial em meliHttp.ts) em vez de Chrome/Playwright. Tag movida
// do `.env` pro banco (aba Config. Afiliados) no mesmo commit — mesmo
// padrão da config da Shopee, não precisa reiniciar pra trocar.
const geradorBase: GeradorDeLinkAfiliado = {
  plataforma: "mercado_livre",
  async gerar(usuarioId: number, urlProduto: string): Promise<string> {
    const config = await configuracoesRepo.obterMeliAfiliadoConfig(usuarioId);
    if (!config?.tag) {
      throw new Error("Tag de afiliado do Mercado Livre não configurada — configure na aba Config. Afiliados");
    }
    return criarLinkOficial(usuarioId, urlProduto, config.tag);
  },
};

export const linkMercadoLivre = comCache(geradorBase);
