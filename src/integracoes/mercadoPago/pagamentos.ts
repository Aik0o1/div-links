import { chamarMercadoPago } from "./cliente.js";

export interface PagamentoMercadoPago {
  id: string;
  /** "approved" | "pending" | "rejected" | ... (valores reais da API do MP). */
  status: string;
  valor: number;
  externalReference: string | null;
}

export async function buscarPagamento(id: string): Promise<PagamentoMercadoPago> {
  const corpo = await chamarMercadoPago(`/v1/payments/${id}`);
  return {
    id: String(corpo.id),
    status: corpo.status,
    valor: Number(corpo.transaction_amount),
    externalReference: corpo.external_reference ?? null,
  };
}
