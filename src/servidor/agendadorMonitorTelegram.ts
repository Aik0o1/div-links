import { verificarNovasMensagens } from "../integracoes/telegramListener/cliente.js";
import { processarMensagemGrupo } from "../servicos/processarMensagemGrupo.js";
import * as usuariosRepo from "../repositorios/usuarios.js";
import { logger } from "../config/logger.js";

const INTERVALO_VERIFICACAO_MS = 45 * 1000; // confere grupos monitorados a cada 45s

export function iniciarAgendadorMonitorTelegram(): void {
  // `setInterval` não espera o callback terminar — se uma rodada demora mais
  // que 45s pra um tenant, a próxima rodada geral começando em paralelo
  // podia rodar ESSE MESMO tenant de novo, as duas lendo o mesmo cursor
  // (ainda não atualizado) e processando a MESMA mensagem duas vezes (bug
  // real, ver histórico anterior ao multi-tenant). Guard por tenant (Set),
  // não mais um único booleano de módulo — diferente de antes, tenants
  // DIFERENTES podem rodar em paralelo entre si (cada um com seu próprio
  // TelegramClient, sem recurso compartilhado, ver telegramListener/cliente.ts).
  const emAndamento = new Set<number>();

  const rodarTenant = async (usuarioId: number) => {
    if (emAndamento.has(usuarioId)) return;
    emAndamento.add(usuarioId);
    try {
      await verificarNovasMensagens(usuarioId, (texto, grupoId, nicho) =>
        processarMensagemGrupo(usuarioId, texto, "telegram", nicho, grupoId),
      );
    } catch (err) {
      logger.error({ err, usuarioId }, "falha ao verificar mensagens novas do monitor de Telegram desse tenant");
    } finally {
      emAndamento.delete(usuarioId);
    }
  };

  const rodarTodosOsTenants = async () => {
    const usuarios = await usuariosRepo.listarAtivos();
    for (const { id: usuarioId } of usuarios) {
      // Não espera terminar — cada tenant roda de forma independente
      // (ver comentário do Set acima), então dispara todos sem `await` em
      // série aqui.
      rodarTenant(usuarioId);
    }
  };

  rodarTodosOsTenants();
  setInterval(rodarTodosOsTenants, INTERVALO_VERIFICACAO_MS);
  logger.info("agendador do monitor de grupos do Telegram rodando (confere a cada 45s)");
}
