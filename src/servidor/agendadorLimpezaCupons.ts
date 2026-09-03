import * as cuponsRepo from "../repositorios/cupons.js";
import { logger } from "../config/logger.js";

// Só serve pra mostrar na aba Cupons e pra retentativa de curto prazo (3h,
// ver JANELA_RETENTATIVA_HORAS em repositorios/cupons.ts) — não tem motivo
// pra acumular pra sempre no banco.
const DIAS_RETENCAO = 7;
const INTERVALO_MS = 24 * 60 * 60 * 1000; // roda 1x por dia

async function limpar(): Promise<void> {
  try {
    const removidos = await cuponsRepo.removerAntigos(DIAS_RETENCAO);
    if (removidos > 0) {
      logger.info({ removidos, diasRetencao: DIAS_RETENCAO }, "cupons antigos removidos");
    }
  } catch (err) {
    logger.error({ err }, "falha ao limpar cupons antigos");
  }
}

export function iniciarAgendadorLimpezaCupons(): void {
  limpar();
  setInterval(limpar, INTERVALO_MS);
  logger.info({ diasRetencao: DIAS_RETENCAO }, "agendador de limpeza de cupons antigos rodando (1x por dia)");
}
