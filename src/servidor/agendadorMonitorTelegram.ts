import { verificarNovasMensagens } from "../integracoes/telegramListener/cliente.js";
import { processarMensagemGrupo } from "../servicos/processarMensagemGrupo.js";
import { logger } from "../config/logger.js";

const INTERVALO_VERIFICACAO_MS = 45 * 1000; // confere grupos monitorados a cada 45s

export function iniciarAgendadorMonitorTelegram(): void {
  // `setInterval` não espera o callback terminar — se uma rodada demora mais
  // que 45s (raspagem de produto no Chrome pode levar bem mais, sobretudo
  // com várias mensagens pra processar), a próxima começava em paralelo,
  // as duas lendo o mesmo cursor (ainda não atualizado) e processando a
  // MESMA mensagem duas vezes. Bug real: "Gloss Fran By Franciny..."
  // capturado 2x, ~1min de diferença — a segunda tentativa, rodando ao
  // mesmo tempo que a primeira, competiu por recursos do Chrome e falhou em
  // extrair o preço. Esse guard garante só uma rodada por vez.
  let emAndamento = false;

  const rodar = async () => {
    if (emAndamento) return;
    emAndamento = true;
    try {
      await verificarNovasMensagens((texto, _grupoId, nicho, baixarImagem) =>
        processarMensagemGrupo(texto, "telegram", nicho, baixarImagem),
      );
    } catch (err) {
      logger.error({ err }, "falha ao verificar mensagens novas do monitor de Telegram");
    } finally {
      emAndamento = false;
    }
  };

  rodar();
  setInterval(rodar, INTERVALO_VERIFICACAO_MS);
  logger.info("agendador do monitor de grupos do Telegram rodando (confere a cada 45s)");
}
