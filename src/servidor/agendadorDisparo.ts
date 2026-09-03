import * as canaisRepo from "../repositorios/canais.js";
import * as disparosRepo from "../repositorios/disparos.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import type { JanelaDisparoAutomatico } from "../repositorios/configuracoes.js";
import * as usuariosRepo from "../repositorios/usuarios.js";
import { proximoProdutoElegivel, dispararParaCanal } from "../servicos/dispararProduto.js";
import { dispararCupomPendente } from "../servicos/repassarCupons.js";
import { logger } from "../config/logger.js";

const INTERVALO_VERIFICACAO_MS = 60 * 1000; // confere a cada 1 minuto quais canais estão "na hora"

/** Minutos desde 00:00 no fuso America/Sao_Paulo, mesmo fuso usado pros
 * cortes de "hoje" no resto do sistema (ver repositorios/disparos.ts). */
function minutosAgoraSaoPaulo(): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "0");
  const minuto = Number(partes.find((p) => p.type === "minute")?.value ?? "0");
  return hora * 60 + minuto;
}

function paraMinutos(horaMinuto: string): number {
  const [h, m] = horaMinuto.split(":").map(Number);
  return h * 60 + m;
}

/** Suporta janela que vira a noite (ex.: 22:00 -> 06:00). Início == fim
 * conta como "sem restrição" (evita um usuário travar o próprio disparo
 * por engano com uma janela de duração zero). */
function dentroDaJanela(janela: JanelaDisparoAutomatico): boolean {
  const inicio = paraMinutos(janela.inicio);
  const fim = paraMinutos(janela.fim);
  if (inicio === fim) return true;
  const agora = minutosAgoraSaoPaulo();
  if (inicio < fim) return agora >= inicio && agora < fim;
  return agora >= inicio || agora < fim;
}

async function processarCanal(usuarioId: number, canal: Awaited<ReturnType<typeof canaisRepo.listar>>[number]) {
  const ultimoEnvio = await disparosRepo.ultimoEnvioGeralPorCanal(usuarioId, canal.id);
  if (ultimoEnvio) {
    const minutosDesde = (Date.now() - new Date(ultimoEnvio).getTime()) / 60000;
    if (minutosDesde < canal.intervaloMinimoMinutos) return;
  }

  // Cupom de grupo monitorado tem prioridade máxima — mais até que produto
  // de grupo monitorado (que já fura a fila de produtos, ver
  // produtosRepo.listarPorNichos). Só passa pro produto se não tiver cupom
  // pendente pra esse canal.
  const cupomPendente = await dispararCupomPendente(usuarioId, canal);
  if (cupomPendente) {
    if (cupomPendente.status === "enviado") {
      logger.info(
        { usuarioId, canalId: canal.id, cupomId: cupomPendente.cupomId },
        "cupom pendente repassado (prioridade máxima)",
      );
    } else {
      logger.error(
        { usuarioId, canalId: canal.id, cupomId: cupomPendente.cupomId },
        "falha ao repassar cupom pendente (prioridade máxima)",
      );
    }
    return;
  }

  const produto = await proximoProdutoElegivel(usuarioId, canal);
  if (!produto) return;

  try {
    await dispararParaCanal(usuarioId, produto.id, canal.id);
    logger.info(
      { usuarioId, produtoId: produto.id, canalId: canal.id, titulo: produto.titulo },
      "disparo automático enviado",
    );
  } catch (err) {
    logger.error({ err, usuarioId, canalId: canal.id, produtoId: produto.id }, "falha no disparo automático");
  }
}

async function verificarTenant(usuarioId: number): Promise<void> {
  const ativo = await configuracoesRepo.obterDisparoAutomaticoAtivo(usuarioId);
  if (!ativo) return;

  const janela = await configuracoesRepo.obterJanelaDisparoAutomatico(usuarioId);
  if (janela && !dentroDaJanela(janela)) return;

  const canais = await canaisRepo.listar(usuarioId);
  for (const canal of canais.filter((c) => c.ativo)) {
    await processarCanal(usuarioId, canal);
  }
}

/**
 * Itera todo tenant ativo, cada um com seu próprio try/catch — falha de um
 * (ex.: cookie do ML expirado) não pode travar o disparo dos outros. Mantido
 * sequencial entre tenants por simplicidade (não é mais uma limitação
 * técnica desde que o Chrome compartilhado foi eliminado, 2026-08-13) — pode
 * virar paralelo depois se a latência total (N tenants × tempo por tenant)
 * incomodar.
 */
async function verificarTodosOsTenants(): Promise<void> {
  const usuarios = await usuariosRepo.listarAtivos();
  for (const { id: usuarioId } of usuarios) {
    try {
      await verificarTenant(usuarioId);
    } catch (err) {
      logger.error({ err, usuarioId }, "falha ao processar disparo automático desse tenant");
    }
  }
}

export function iniciarAgendadorDisparo(): void {
  verificarTodosOsTenants();
  setInterval(verificarTodosOsTenants, INTERVALO_VERIFICACAO_MS);
  logger.info("agendador de disparo automático rodando (confere a cada 1 min)");
}
