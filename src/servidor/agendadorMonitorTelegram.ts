import { verificarNovasMensagens } from "../integracoes/telegramListener/cliente.js";
import { processarMensagemGrupo } from "../servicos/processarMensagemGrupo.js";
import { logger } from "../config/logger.js";

const INTERVALO_VERIFICACAO_MS = 45 * 1000; // confere grupos monitorados a cada 45s

export function iniciarAgendadorMonitorTelegram(): void {
  const rodar = () => {
    verificarNovasMensagens((texto, _grupoId, nicho) => processarMensagemGrupo(texto, "telegram", nicho)).catch(
      (err) => {
        logger.error({ err }, "falha ao verificar mensagens novas do monitor de Telegram");
      },
    );
  };

  rodar();
  setInterval(rodar, INTERVALO_VERIFICACAO_MS);
  logger.info("agendador do monitor de grupos do Telegram rodando (confere a cada 45s)");
}
