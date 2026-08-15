import * as produtosRepo from "../repositorios/produtos.js";
import { buscarImagemOficialProduto } from "../integracoes/shopee/api.js";
import { logger } from "../config/logger.js";
import type { ProdutoCardShopeeDetectado } from "./parsearProdutoCardShopee.js";

export type OrigemGrupoMonitorado = "telegram" | "whatsapp";

// Nicho dedicado — isolado do resto via `categorias_permitidas` do canal
// "teste shopee" (só ele aceita esse nicho). Enquanto a integração está em
// teste, nenhum outro canal deve receber produto da Shopee — decisão
// explícita do usuário.
const NICHO_TESTE_SHOPEE = "shopee";

/**
 * Diferente do Mercado Livre: sem scraping da página real (site bloqueia
 * automação) — título, preço e cupom vêm do próprio texto do post (ver
 * parsearProdutoCardShopee.ts). A IMAGEM nunca vem do post — já veio com
 * logo/marca d'água do grupo monitorado em produção (bug real relatado pelo
 * usuário) — sempre busca a imagem oficial da Shopee via API
 * (buscarImagemOficialProduto, resolve o link pro shopId/itemId e consulta
 * productOfferV2). Sem imagem oficial disponível, o produto é descartado —
 * nunca cai de volta pra imagem do post.
 *
 * O link de afiliado NÃO é gerado aqui — só na hora do disparo (mesmo
 * padrão do Mercado Livre, ver dispararProduto.ts), guardamos só a URL
 * original do produto.
 */
export async function processarProdutoDetectadoShopee(
  usuarioId: number,
  produto: ProdutoCardShopeeDetectado,
  origem: OrigemGrupoMonitorado,
  grupoId?: string,
): Promise<void> {
  if (!produto.titulo) {
    logger.debug({ urlBruta: produto.urlBruta }, "produto Shopee sem título reconhecível no post, ignorado");
    return;
  }

  let imagemUrl: string | null;
  try {
    imagemUrl = await buscarImagemOficialProduto(usuarioId, produto.urlBruta);
  } catch (err) {
    logger.warn({ err, urlBruta: produto.urlBruta }, "falha ao buscar imagem oficial do produto Shopee, ignorado");
    return;
  }
  if (!imagemUrl) {
    logger.warn(
      { urlBruta: produto.urlBruta },
      "não foi possível resolver a imagem oficial do produto Shopee (link mudou de formato ou produto saiu do ar) — ignorado, nunca usa a imagem do post",
    );
    return;
  }

  try {
    const resultado = await produtosRepo.inserirSeNovo(usuarioId, {
      fonte: origem === "telegram" ? "telegram_shopee" : "whatsapp_shopee",
      urlOriginal: produto.urlBruta,
      titulo: produto.titulo,
      precoOriginal: produto.precos?.precoOriginal ?? undefined,
      precoPromocional: produto.precos?.precoPromocional,
      imagemUrl,
      cupom: produto.cupom ?? undefined,
      nicho: NICHO_TESTE_SHOPEE,
      precoNoPix: produto.precos?.noPix ?? false,
      grupoOrigemId: grupoId,
      linkCupom: produto.linkCupom ?? undefined,
      chamada: produto.chamada ?? undefined,
    });

    if (resultado) {
      logger.info(
        { produtoId: resultado.id, titulo: resultado.titulo, cupom: produto.cupom },
        "produto Shopee capturado — entra na fila do disparo automático (canal de teste)",
      );
    } else {
      logger.debug({ urlBruta: produto.urlBruta }, "produto Shopee já capturado antes, ignorado");
    }
  } catch (err) {
    logger.error({ err, urlBruta: produto.urlBruta }, "falha ao processar produto Shopee de grupo monitorado");
  }
}
