import { buscarOfertasShopee } from "../integracoes/shopee/ofertasApi.js";
import * as produtosRepo from "../repositorios/produtos.js";
import { logger } from "../config/logger.js";

// Mesmo nicho dedicado usado pela captura via grupo monitorado (ver
// capturarProdutoShopee.ts) — isolado do resto por enquanto, só o canal
// "teste shopee" aceita esse nicho.
const NICHO_TESTE_SHOPEE = "shopee";

const PAGINAS = 5;
const ITENS_POR_PAGINA = 20;

export interface ResultadoCapturaShopee {
  novos: number;
  duplicados: number;
  total: number;
}

/**
 * Captura em massa de ofertas gerais da Shopee via API oficial
 * (`productOfferV2`) — equivalente ao "Capturar agora" do Mercado Livre, mas
 * sem apagar a tabela antes (diferente do ML): a captura via grupo
 * monitorado já convive na mesma tabela, e zerar tudo apagaria produto de
 * grupo monitorado ainda não disparado (mesmo problema já visto com o
 * Mercado Livre). Só insere, deduplicado por hash.
 */
export async function capturarProdutosShopee(): Promise<ResultadoCapturaShopee> {
  const ofertas = await buscarOfertasShopee(PAGINAS, ITENS_POR_PAGINA);

  let novos = 0;
  let duplicados = 0;

  for (const oferta of ofertas) {
    if (!oferta.titulo || !oferta.imagemUrl) continue;

    const precoOriginal =
      oferta.descontoPercentual > 0
        ? Number((oferta.precoPromocional / (1 - oferta.descontoPercentual / 100)).toFixed(2))
        : undefined;

    const resultado = await produtosRepo.inserirSeNovo({
      fonte: "shopee",
      urlOriginal: oferta.productLink,
      urlAfiliado: oferta.offerLink,
      titulo: oferta.titulo,
      precoOriginal,
      precoPromocional: oferta.precoPromocional,
      imagemUrl: oferta.imagemUrl,
      nicho: NICHO_TESTE_SHOPEE,
    });

    if (resultado) novos++;
    else duplicados++;
  }

  logger.info({ novos, duplicados, total: ofertas.length }, "captura de ofertas Shopee concluída");
  return { novos, duplicados, total: ofertas.length };
}
