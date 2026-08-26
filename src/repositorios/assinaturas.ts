import { pool } from "../db/pool.js";
import type { PlanoId } from "../servicos/planos.js";

export type StatusAssinatura = "trial" | "pendente" | "ativa" | "atrasada" | "cancelada" | "isenta";

export interface AssinaturaRow {
  id: number;
  usuarioId: number;
  plano: PlanoId;
  status: StatusAssinatura;
  mpPreapprovalId: string | null;
  trialExpiraEm: string | null;
  proximaCobrancaEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

function paraAssinatura(row: any): AssinaturaRow {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    plano: row.plano,
    status: row.status,
    mpPreapprovalId: row.mp_preapproval_id,
    trialExpiraEm: row.trial_expira_em,
    proximaCobrancaEm: row.proxima_cobranca_em,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

/**
 * Acesso liberado: ativa/isenta sempre, ou `trial_expira_em` ainda no
 * futuro — checado pela DATA, não pelo campo `status` literal ser "trial".
 * Importante: iniciar um checkout marca `status = 'pendente'` (ver
 * definirCheckoutPendente) SEM apagar `trial_expira_em` — um tenant que
 * ainda está no período grátis e clica "Assinar" não pode perder acesso na
 * hora só por ter começado o checkout, antes mesmo de confirmar ou falhar o
 * pagamento (bug real pego testando: acessoLiberado virava false no mesmo
 * instante do clique, checando só `status === 'trial'` literal).
 */
export function acessoLiberado(assinatura: AssinaturaRow | null): boolean {
  if (!assinatura) return false;
  if (assinatura.status === "ativa" || assinatura.status === "isenta") return true;
  if (assinatura.trialExpiraEm) {
    return new Date(assinatura.trialExpiraEm).getTime() > Date.now();
  }
  return false;
}

export async function buscarPorUsuarioId(usuarioId: number): Promise<AssinaturaRow | null> {
  const { rows } = await pool.query("SELECT * FROM assinaturas WHERE usuario_id = $1", [usuarioId]);
  return rows[0] ? paraAssinatura(rows[0]) : null;
}

/** Chamado uma vez no signup (ver rotas/auth.ts) — todo tenant novo começa com 7 dias grátis no Básico. */
export async function criarTrial(usuarioId: number, diasTrial: number): Promise<AssinaturaRow> {
  const { rows } = await pool.query(
    `INSERT INTO assinaturas (usuario_id, plano, status, trial_expira_em)
     VALUES ($1, 'basico', 'trial', now() + ($2::text || ' days')::interval)
     RETURNING *`,
    [usuarioId, diasTrial],
  );
  return paraAssinatura(rows[0]);
}

/** Registra a criação de um checkout — assinatura fica "pendente" até o Mercado Pago confirmar (webhook ou polling, ver serviços/assinatura.ts). */
export async function definirCheckoutPendente(
  usuarioId: number,
  plano: PlanoId,
  mpPreapprovalId: string,
): Promise<AssinaturaRow> {
  const { rows } = await pool.query(
    `UPDATE assinaturas SET plano = $2, status = 'pendente', mp_preapproval_id = $3, atualizado_em = now()
     WHERE usuario_id = $1
     RETURNING *`,
    [usuarioId, plano, mpPreapprovalId],
  );
  return paraAssinatura(rows[0]);
}

/**
 * Atualiza pelo id da preapproval no Mercado Pago — usado tanto pelo webhook
 * quanto pelo polling ativo (`POST /assinatura/verificar`), sempre a partir
 * do estado JÁ CONFIRMADO direto na API do MP (nunca do corpo do webhook
 * sozinho). Sem efeito se não achar nenhuma assinatura com essa preapproval
 * (ex.: webhook duplicado depois de já ter trocado de plano).
 */
export async function atualizarPorPreapprovalId(
  mpPreapprovalId: string,
  status: StatusAssinatura,
  proximaCobrancaEm: string | null,
): Promise<AssinaturaRow | null> {
  const { rows } = await pool.query(
    `UPDATE assinaturas SET status = $2, proxima_cobranca_em = $3, atualizado_em = now()
     WHERE mp_preapproval_id = $1
     RETURNING *`,
    [mpPreapprovalId, status, proximaCobrancaEm],
  );
  return rows[0] ? paraAssinatura(rows[0]) : null;
}

export async function cancelarPorUsuarioId(usuarioId: number): Promise<void> {
  await pool.query(
    `UPDATE assinaturas SET status = 'cancelada', atualizado_em = now() WHERE usuario_id = $1`,
    [usuarioId],
  );
}
