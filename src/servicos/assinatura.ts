import * as assinaturasRepo from "../repositorios/assinaturas.js";
import * as pagamentosRepo from "../repositorios/pagamentos.js";
import * as usuariosRepo from "../repositorios/usuarios.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import { criarPreapproval, buscarPreapproval, cancelarPreapproval } from "../integracoes/mercadoPago/preapproval.js";
import { buscarPagamento } from "../integracoes/mercadoPago/pagamentos.js";
import { PLANOS, type PlanoId } from "./planos.js";
import { logger } from "../config/logger.js";
import type { StatusAssinatura } from "../repositorios/assinaturas.js";

/** Toda conta nova ganha esse tanto de dias grátis no plano Básico (ver rotas/auth.ts). */
export const DIAS_TRIAL_GRATIS = 7;

/** "pending" | "authorized" | "paused" | "cancelled" (valores reais da API do MP) -> nosso enum. */
function statusMercadoPagoParaLocal(statusMp: string): StatusAssinatura {
  switch (statusMp) {
    case "authorized":
      return "ativa";
    case "paused":
      return "atrasada";
    case "cancelled":
      return "cancelada";
    default:
      return "pendente";
  }
}

/**
 * Cria uma nova assinatura recorrente e devolve o link pra redirecionar o
 * tenant. Cancela a preapproval antiga no Mercado Pago primeiro se já
 * existir uma (troca de plano) — nunca deixa duas preapprovals ativas pro
 * mesmo tenant ao mesmo tempo.
 */
export async function iniciarCheckout(usuarioId: number, plano: PlanoId, backUrl: string): Promise<string> {
  const usuario = await usuariosRepo.buscarPorId(usuarioId);
  if (!usuario) throw new Error("Usuário não encontrado");

  const atual = await assinaturasRepo.buscarPorUsuarioId(usuarioId);
  // Bug real (2026-08-26): conta isenta (ex.: a do dono do produto) clicou
  // em "Assinar" só pra testar e isso sobrescreveu o status pra "pendente",
  // apagando a isenção e bloqueando o próprio acesso na hora (isenta não
  // tem trial_expira_em preenchido, então acessoLiberado() não tinha mais
  // nenhum motivo pra liberar). Conta isenta nunca deveria conseguir
  // "comprar" um plano por esse fluxo — ela já tem acesso liberado de
  // propósito, sem depender do Mercado Pago.
  if (atual?.status === "isenta") {
    throw new Error("Essa conta é isenta de cobrança e não passa pelo checkout.");
  }
  if (atual?.mpPreapprovalId && atual.status !== "cancelada") {
    await cancelarPreapproval(atual.mpPreapprovalId).catch((err) => {
      logger.warn({ err, usuarioId }, "falha ao cancelar preapproval antiga (seguindo pra criar a nova mesmo assim)");
    });
  }

  const criada = await criarPreapproval(usuarioId, plano, usuario.email, backUrl);
  await assinaturasRepo.definirCheckoutPendente(usuarioId, plano, criada.id);
  return criada.initPoint;
}

export async function cancelarAssinatura(usuarioId: number): Promise<void> {
  const atual = await assinaturasRepo.buscarPorUsuarioId(usuarioId);
  if (atual?.mpPreapprovalId) {
    await cancelarPreapproval(atual.mpPreapprovalId).catch((err) => {
      logger.warn({ err, usuarioId }, "falha ao cancelar preapproval no Mercado Pago (marcando cancelada localmente mesmo assim)");
    });
  }
  await assinaturasRepo.cancelarPorUsuarioId(usuarioId);
}

/**
 * Consulta o estado ATUAL direto na API do MP e atualiza local — usado pelo
 * polling ativo (`POST /assinatura/verificar`, chamado quando o tenant volta
 * do checkout) e reaproveitado pelo webhook de preapproval (que só dispara
 * ISSO, nunca confia no corpo do próprio webhook pra decidir o status).
 */
export async function sincronizarStatusPorPreapprovalId(mpPreapprovalId: string): Promise<void> {
  const status = await buscarPreapproval(mpPreapprovalId);
  await assinaturasRepo.atualizarPorPreapprovalId(
    mpPreapprovalId,
    statusMercadoPagoParaLocal(status.status),
    status.proximaCobranca,
  );
}

export async function sincronizarStatusDoTenant(usuarioId: number): Promise<assinaturasRepo.AssinaturaRow | null> {
  const atual = await assinaturasRepo.buscarPorUsuarioId(usuarioId);
  if (atual?.mpPreapprovalId) {
    await sincronizarStatusPorPreapprovalId(atual.mpPreapprovalId);
  }
  return assinaturasRepo.buscarPorUsuarioId(usuarioId);
}

const REGEX_EXTERNAL_REFERENCE = /^usuario:(\d+)$/;

/**
 * Processa notificação de pagamento (cobrança recorrente aprovada/recusada)
 * — busca o pagamento real no MP (nunca confia no corpo do webhook),
 * registra no histórico e, se aprovado, garante que a assinatura
 * correspondente está marcada como ativa (mesmo que o webhook de
 * preapproval associado ainda não tenha chegado).
 */
export async function processarNotificacaoPagamento(mpPaymentId: string): Promise<void> {
  const pagamento = await buscarPagamento(mpPaymentId);
  const match = pagamento.externalReference ? REGEX_EXTERNAL_REFERENCE.exec(pagamento.externalReference) : null;
  if (!match) {
    logger.warn({ mpPaymentId, externalReference: pagamento.externalReference }, "pagamento sem external_reference reconhecível, ignorado");
    return;
  }
  const usuarioId = Number(match[1]);

  await pagamentosRepo.registrarSeNovo(usuarioId, pagamento.id, pagamento.valor, pagamento.status);

  if (pagamento.status === "approved") {
    const atual = await assinaturasRepo.buscarPorUsuarioId(usuarioId);
    if (atual && atual.status !== "ativa" && atual.mpPreapprovalId) {
      await sincronizarStatusPorPreapprovalId(atual.mpPreapprovalId);
    }
  }
}

export interface PlanoComLimites {
  id: PlanoId;
  nome: string;
  precoCentavos: number;
  limiteCanais: number;
  limiteGruposMonitorados: number;
}

export function listarPlanos(): PlanoComLimites[] {
  return (Object.keys(PLANOS) as PlanoId[]).map((id) => ({ id, ...PLANOS[id] }));
}

/**
 * Limites do plano atual do tenant — usado pelo gating de canais/grupos
 * monitorados (ver rotas/canais.ts, rotas/telegramListener.ts,
 * rotas/whatsapp.ts). Cai no Básico se por algum motivo não achar
 * assinatura (não deveria acontecer: exigirAssinaturaAtiva já garantiu
 * acesso liberado antes dessas rotas rodarem, o que exige uma assinatura
 * existente — isso aqui é só defesa extra, não o caminho esperado).
 */
export async function obterLimitesAtuais(usuarioId: number): Promise<{ limiteCanais: number; limiteGruposMonitorados: number }> {
  const atual = await assinaturasRepo.buscarPorUsuarioId(usuarioId);
  const plano = atual?.plano ?? "basico";
  return PLANOS[plano];
}

/**
 * Limite de grupos monitorados é combinado entre WhatsApp e Telegram (ver
 * plano) — salvar a seleção de uma plataforma precisa somar o que já está
 * salvo na OUTRA antes de comparar com o limite do plano. `plataforma` é a
 * que está sendo salva agora (substituição completa da lista, não
 * incremental — ver rotas/telegramListener.ts e rotas/whatsapp.ts).
 */
export async function validarLimiteGruposMonitorados(
  usuarioId: number,
  plataforma: "telegram" | "whatsapp",
  novaQuantidade: number,
): Promise<{ ok: boolean; limite: number; total: number }> {
  const [{ limiteGruposMonitorados }, telegramGrupos, whatsappGrupos] = await Promise.all([
    obterLimitesAtuais(usuarioId),
    configuracoesRepo.obterTelegramListenerGrupos(usuarioId),
    configuracoesRepo.obterWhatsappGruposMonitorados(usuarioId),
  ]);
  const outraPlataformaCount = plataforma === "telegram" ? whatsappGrupos.length : telegramGrupos.length;
  const total = outraPlataformaCount + novaQuantidade;
  return { ok: total <= limiteGruposMonitorados, limite: limiteGruposMonitorados, total };
}
