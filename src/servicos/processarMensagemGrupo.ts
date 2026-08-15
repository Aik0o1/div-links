import { extrairCupons } from "./parsearCupons.js";
import { extrairProdutoCard } from "./parsearProdutoCard.js";
import { extrairProdutoCardShopee } from "./parsearProdutoCardShopee.js";
import { processarMensagem as processarComoCupons } from "./repassarCupons.js";
import { processarProdutoDetectado, type OrigemGrupoMonitorado } from "./capturarProdutoTerceiro.js";
import { processarProdutoDetectadoShopee } from "./capturarProdutoShopee.js";
import { logger } from "../config/logger.js";

// Grupos cuja "chamada" (frase de impacto do início do post, ver
// extrairChamada em parsearProdutoCard.ts) o usuário pediu explicitamente
// pra NÃO usar — decisão por grupo, não por conteúdo (diferente do filtro de
// marca "lobo", que vale pra qualquer grupo). O produto continua sendo
// capturado normalmente, só sem a chamada.
const GRUPOS_SEM_CHAMADA = new Set<string>([
  "120363410529460005@g.us", // Ofertas de Casa 🏡 | Gii #32 (WhatsApp)
]);

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
 * igual pras duas plataformas e não tem conceito de nicho. A imagem do
 * produto Shopee nunca vem do post monitorado (ver capturarProdutoShopee.ts)
 * — sempre busca a oficial via API, não precisa baixar nada aqui.
 */
export async function processarMensagemGrupo(
  usuarioId: number,
  texto: string,
  origem: OrigemGrupoMonitorado,
  nicho: string,
  grupoId?: string,
): Promise<void> {
  if (extrairCupons(texto).length > 0) {
    await processarComoCupons(usuarioId, texto, grupoId);
    return;
  }

  const semChamada = grupoId !== undefined && GRUPOS_SEM_CHAMADA.has(grupoId);

  const produtoDetectado = extrairProdutoCard(texto);
  if (produtoDetectado) {
    await processarProdutoDetectado(
      usuarioId,
      produtoDetectado.urlBruta,
      produtoDetectado.cupom,
      semChamada ? null : produtoDetectado.chamada,
      origem,
      nicho,
      texto,
      grupoId,
    );
    return;
  }

  const produtoShopee = extrairProdutoCardShopee(texto);
  if (produtoShopee) {
    await processarProdutoDetectadoShopee(
      usuarioId,
      semChamada ? { ...produtoShopee, chamada: null } : produtoShopee,
      origem,
      grupoId,
    );
    return;
  }

  logger.debug("mensagem de grupo monitorado não reconhecida (nem cupom, nem produto), ignorada");
}
