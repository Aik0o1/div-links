import { extrairCupons } from "./parsearCupons.js";
import { extrairProdutoCard } from "./parsearProdutoCard.js";
import { processarMensagem as processarComoCupons } from "./repassarCupons.js";
import { processarProdutoDetectado, type OrigemGrupoMonitorado } from "./capturarProdutoTerceiro.js";
import { logger } from "../config/logger.js";

/**
 * Ponto de entrada único pra qualquer mensagem nova vinda de um grupo
 * monitorado (Telegram ou WhatsApp — pode ser um grupo de lista de cupons
 * genéricos ou um grupo de card de produto, o mesmo processamento cobre os
 * dois tipos). Tenta primeiro como lista de cupons (padrão rígido, ver
 * parsearCupons.ts); se não bater, tenta como card de produto (link + cupom
 * opcional, título/preço/imagem vêm da página real do ML).
 *
 * `origem` e `nicho` só importam pro caminho de produto (fila prioritária e
 * roteamento por nicho, respectivamente) — o fluxo de cupons genéricos é
 * igual pras duas plataformas e não tem conceito de nicho.
 */
export async function processarMensagemGrupo(
  texto: string,
  origem: OrigemGrupoMonitorado,
  nicho: string,
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

  logger.debug("mensagem de grupo monitorado não reconhecida (nem cupom, nem produto), ignorada");
}
