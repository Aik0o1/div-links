import { buscarOfertasShopee, type OfertaShopee } from "../integracoes/shopee/ofertasApi.js";
import { NICHO_SHOPEE_KEYWORDS } from "../integracoes/shopee/nichoKeywords.js";
import * as produtosRepo from "../repositorios/produtos.js";
import { logger } from "../config/logger.js";

const PAGINAS_GERAL = 5;
const PAGINAS_POR_PALAVRA_CHAVE = 2;
const ITENS_POR_PAGINA = 20;

export interface ResultadoCapturaShopee {
  novos: number;
  duplicados: number;
  total: number;
}

async function inserirOfertas(
  usuarioId: number,
  ofertas: OfertaShopee[],
  nicho: string,
): Promise<{ novos: number; duplicados: number }> {
  let novos = 0;
  let duplicados = 0;

  for (const oferta of ofertas) {
    if (!oferta.titulo || !oferta.imagemUrl) continue;

    const precoOriginal =
      oferta.descontoPercentual > 0
        ? Number((oferta.precoPromocional / (1 - oferta.descontoPercentual / 100)).toFixed(2))
        : undefined;

    const resultado = await produtosRepo.inserirSeNovo(usuarioId, {
      fonte: "shopee",
      urlOriginal: oferta.productLink,
      urlAfiliado: oferta.offerLink,
      titulo: oferta.titulo,
      precoOriginal,
      precoPromocional: oferta.precoPromocional,
      imagemUrl: oferta.imagemUrl,
      nicho,
    });

    if (resultado) novos++;
    else duplicados++;
  }

  return { novos, duplicados };
}

/**
 * Captura ofertas da Shopee via API oficial (`productOfferV2`) pra UM nicho
 * (aba Produtos) — sem apagar a tabela antes (diferente do ML: a captura via
 * grupo monitorado já convive na mesma tabela, e zerar tudo apagaria produto
 * ainda não disparado). Só insere, deduplicado por hash.
 *
 * "geral" pega o catálogo amplo sem filtro; os demais buscam por
 * palavra-chave curada (ver nichoKeywords.ts — a Shopee não tem um filtro de
 * categoria confiável equivalente ao "category=MLB..." do ML). Nicho sem
 * palavra-chave definida (ex.: nicho novo criado só pro ML) retorna vazio,
 * sem erro.
 */
export async function capturarProdutosShopeePorNicho(usuarioId: number, nichoId: string): Promise<ResultadoCapturaShopee> {
  let novos = 0;
  let duplicados = 0;
  let total = 0;

  if (nichoId === "geral") {
    const ofertas = await buscarOfertasShopee(usuarioId, PAGINAS_GERAL, ITENS_POR_PAGINA);
    total += ofertas.length;
    const r = await inserirOfertas(usuarioId, ofertas, "geral");
    novos += r.novos;
    duplicados += r.duplicados;
  } else {
    const palavrasChave = NICHO_SHOPEE_KEYWORDS[nichoId] ?? [];
    for (const palavra of palavrasChave) {
      const ofertas = await buscarOfertasShopee(usuarioId, PAGINAS_POR_PALAVRA_CHAVE, ITENS_POR_PAGINA, palavra);
      total += ofertas.length;
      const r = await inserirOfertas(usuarioId, ofertas, nichoId);
      novos += r.novos;
      duplicados += r.duplicados;
    }
  }

  logger.info({ usuarioId, nicho: nichoId, novos, duplicados, total }, "captura de ofertas Shopee por nicho concluída");
  return { novos, duplicados, total };
}
