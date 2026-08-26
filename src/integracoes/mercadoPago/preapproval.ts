import { chamarMercadoPago } from "./cliente.js";
import { PLANOS, type PlanoId } from "../../servicos/planos.js";

export interface PreapprovalCriada {
  id: string;
  initPoint: string;
  status: string;
}

/**
 * Cria uma assinatura recorrente (Checkout Pro de assinatura — a API de
 * "preapproval" do Mercado Pago) e devolve o link (`init_point`) pra
 * redirecionar o tenant pra autorizar. `externalReference` carrega o
 * usuarioId pra conseguir correlacionar de volta no webhook/polling sem
 * depender só do `mp_preapproval_id` já salvo (defesa em profundidade).
 */
export async function criarPreapproval(
  usuarioId: number,
  plano: PlanoId,
  payerEmail: string,
  backUrl: string,
): Promise<PreapprovalCriada> {
  const config = PLANOS[plano];
  const corpo = await chamarMercadoPago("/preapproval", {
    method: "POST",
    body: {
      reason: `PromoFlow — Plano ${config.nome}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: config.precoCentavos / 100,
        currency_id: "BRL",
      },
      back_url: backUrl,
      payer_email: payerEmail,
      external_reference: `usuario:${usuarioId}`,
    },
  });
  return { id: corpo.id, initPoint: corpo.init_point, status: corpo.status };
}

export interface PreapprovalStatus {
  id: string;
  /** "pending" | "authorized" | "paused" | "cancelled" (valores reais da API do MP). */
  status: string;
  proximaCobranca: string | null;
}

export async function buscarPreapproval(id: string): Promise<PreapprovalStatus> {
  const corpo = await chamarMercadoPago(`/preapproval/${id}`);
  return {
    id: corpo.id,
    status: corpo.status,
    proximaCobranca: corpo.auto_recurring?.next_payment_date ?? null,
  };
}

export async function cancelarPreapproval(id: string): Promise<void> {
  await chamarMercadoPago(`/preapproval/${id}`, { method: "PUT", body: { status: "cancelled" } });
}
