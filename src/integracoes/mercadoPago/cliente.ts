import { requiredMercadoPagoConfig } from "../../config/env.js";

const BASE_URL = "https://api.mercadopago.com";

export async function chamarMercadoPago(
  caminho: string,
  opcoes: { method?: string; body?: unknown } = {},
): Promise<any> {
  const { accessToken } = requiredMercadoPagoConfig();

  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    method: opcoes.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });

  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(
      `Falha ao chamar Mercado Pago (${caminho}, ${resposta.status}): ${JSON.stringify(corpo)}`,
    );
  }

  return corpo;
}
