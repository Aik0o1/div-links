import { requiredEvolutionConfig } from "../../config/env.js";

export async function chamarEvolutionApi(
  caminho: string,
  opcoes: { method?: string; body?: unknown } = {},
): Promise<any> {
  const { url, apiKey } = requiredEvolutionConfig();

  const resposta = await fetch(`${url}${caminho}`, {
    method: opcoes.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });

  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(
      `Falha ao chamar Evolution API (${caminho}, ${resposta.status}): ${JSON.stringify(corpo)}`,
    );
  }

  return corpo;
}
