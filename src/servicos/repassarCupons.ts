import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cuponsRepo from "../repositorios/cupons.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import { enviarFotoLocalComLegenda as enviarFotoLocalTelegram } from "../integracoes/telegram/bot.js";
import { enviarFotoLocalComLegenda as enviarFotoLocalWhatsapp } from "../integracoes/evolutionApi/bot.js";
import { extrairCupons, formatarLegendaCupons } from "./parsearCupons.js";
import { logger } from "../config/logger.js";
import type { CanalRow } from "../repositorios/canais.js";

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BANNER_CUPOM = path.join(RAIZ_PROJETO, "src", "assets", "imgs", "MLimg.jpeg");

/**
 * Só captura e valida o post do grupo de cupons monitorado — não tenta
 * repassar na hora. Quem repassa é `dispararCupomPendente`, chamado pelo
 * agendador de disparo (`agendadorDisparo.ts`) com prioridade máxima (antes
 * de qualquer produto). Motivo: repassar na hora era "tentativa única" — se
 * o intervalo mínimo do canal ainda não tivesse passado naquele exato
 * momento, o cupom era perdido pra sempre, sem nenhuma retentativa depois
 * (bug real: cupom chegou 2min depois do último disparo pro canal, que
 * exige 5min de intervalo — nunca foi reenviado).
 */
export async function processarMensagem(texto: string): Promise<void> {
  const cupom = await cuponsRepo.inserirSeNovo(texto);
  if (!cupom) {
    logger.debug("mensagem de cupom duplicada, ignorada");
    return;
  }

  const cuponsExtraidos = extrairCupons(texto);
  if (cuponsExtraidos.length === 0) {
    logger.debug("mensagem sem cupom reconhecível (formato inesperado), ignorada");
    return;
  }

  logger.info(
    { cupomId: cupom.id, cupons: cuponsExtraidos.map((c) => c.codigo) },
    "cupom de grupo monitorado capturado — entra na fila com prioridade máxima sobre produtos",
  );
}

export interface ResultadoCupomPendente {
  cupomId: number;
  status: "enviado" | "falhou";
}

/**
 * Tenta repassar o cupom pendente mais antigo pra esse canal (FIFO,
 * ignorando os que já foram enviados com sucesso pra ele — os que só
 * falharam antes continuam pendentes, pra retentativa). Devolve `null` se
 * não há nenhum cupom pendente parseável pra esse canal agora (aí o
 * agendador segue pro fluxo normal de produtos).
 */
export async function dispararCupomPendente(canal: CanalRow): Promise<ResultadoCupomPendente | null> {
  const linkFixo = await configuracoesRepo.obterLinkCupomFixo();
  if (!linkFixo) return null;

  const candidatos = await cuponsRepo.listarPendentesParaCanal(canal.id);

  for (const cupom of candidatos) {
    const cuponsExtraidos = extrairCupons(cupom.texto);
    if (cuponsExtraidos.length === 0) continue; // formato não reconhecível, nunca vai ser repassável

    const legenda = formatarLegendaCupons(cuponsExtraidos, linkFixo);
    try {
      const enviar = canal.tipo === "telegram" ? enviarFotoLocalTelegram : enviarFotoLocalWhatsapp;
      await enviar(BANNER_CUPOM, legenda, canal.identificadorGrupo);
      await cuponsRepo.registrarDisparo(cupom.id, canal.id, "enviado");
      return { cupomId: cupom.id, status: "enviado" };
    } catch (err) {
      logger.error({ err, canalId: canal.id, cupomId: cupom.id }, "falha ao repassar cupom pro canal");
      await cuponsRepo.registrarDisparo(cupom.id, canal.id, "falhou");
      return { cupomId: cupom.id, status: "falhou" };
    }
  }

  return null;
}
