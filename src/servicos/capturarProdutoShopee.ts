import * as produtosRepo from "../repositorios/produtos.js";
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
 * automação) nem API de dados de produto (a API oficial da Shopee só gera
 * link de afiliado) — título, preço e cupom vêm do próprio texto do post
 * (ver parsearProdutoCardShopee.ts), e a imagem é a do post (baixada do
 * Telegram, se tiver) — decisão explícita do usuário, ciente do risco de
 * marca d'água de outro canal.
 *
 * O link de afiliado NÃO é gerado aqui — só na hora do disparo (mesmo
 * padrão do Mercado Livre, ver dispararProduto.ts), guardamos só a URL
 * original do produto.
 */
export async function processarProdutoDetectadoShopee(
  produto: ProdutoCardShopeeDetectado,
  origem: OrigemGrupoMonitorado,
  caminhoImagem: string | undefined,
  grupoId?: string,
): Promise<void> {
  if (!produto.titulo) {
    logger.debug({ urlBruta: produto.urlBruta }, "produto Shopee sem título reconhecível no post, ignorado");
    return;
  }

  try {
    const resultado = await produtosRepo.inserirSeNovo({
      fonte: origem === "telegram" ? "telegram_shopee" : "whatsapp_shopee",
      urlOriginal: produto.urlBruta,
      titulo: produto.titulo,
      precoOriginal: produto.precos?.precoOriginal ?? undefined,
      precoPromocional: produto.precos?.precoPromocional,
      imagemUrl: caminhoImagem,
      cupom: produto.cupom ?? undefined,
      nicho: NICHO_TESTE_SHOPEE,
      precoNoPix: produto.precos?.noPix ?? false,
      grupoOrigemId: grupoId,
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
