import { extrairCupons } from "./parsearCupons.js";
import { extrairProdutoCard } from "./parsearProdutoCard.js";
import { extrairProdutoCardShopee } from "./parsearProdutoCardShopee.js";
import { processarMensagem as processarComoCupons } from "./repassarCupons.js";
import { processarProdutoDetectado, type OrigemGrupoMonitorado } from "./capturarProdutoTerceiro.js";
import { processarProdutoDetectadoShopee } from "./capturarProdutoShopee.js";
import { logger } from "../config/logger.js";

/**
 * Ponto de entrada único pra qualquer mensagem nova vinda de um grupo
 * monitorado (Telegram ou WhatsApp — pode ser um grupo de lista de cupons
 * genéricos, card de produto do ML, ou card de produto da Shopee — o mesmo
 * processamento cobre os três). Tenta cupom-lista primeiro (padrão rígido,
 * ver parsearCupons.ts), depois card de produto do ML (link + cupom
 * opcional, título/preço/imagem vêm da página real), depois card de produto
 * da Shopee (link + cupom + título/preço do próprio texto do post — sem
 * scraping, ver parsearProdutoCardShopee.ts).
 *
 * `origem` e `nicho` só importam pro caminho de produto (fila prioritária e
 * roteamento por nicho, respectivamente) — o fluxo de cupons genéricos é
 * igual pras duas plataformas e não tem conceito de nicho. `baixarImagem` só
 * é usado pelo caminho da Shopee (busca a imagem do post) — vem de
 * telegramListener/cliente.ts, sem equivalente no WhatsApp ainda (webhook
 * só extrai texto/legenda hoje, não baixa mídia).
 */
export async function processarMensagemGrupo(
  texto: string,
  origem: OrigemGrupoMonitorado,
  nicho: string,
  baixarImagem?: () => Promise<string | undefined>,
): Promise<void> {
  if (extrairCupons(texto).length > 0) {
    await processarComoCupons(texto);
    return;
  }

  const produtoDetectado = extrairProdutoCard(texto);
  if (produtoDetectado) {
    await processarProdutoDetectado(produtoDetectado.urlBruta, produtoDetectado.cupom, origem, nicho, texto);
    return;
  }

  const produtoShopee = extrairProdutoCardShopee(texto);
  if (produtoShopee) {
    const caminhoImagem = await baixarImagem?.();
    await processarProdutoDetectadoShopee(produtoShopee, origem, caminhoImagem);
    return;
  }

  logger.debug("mensagem de grupo monitorado não reconhecida (nem cupom, nem produto), ignorada");
}
