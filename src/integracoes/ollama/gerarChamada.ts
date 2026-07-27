import { env } from "../../config/env.js";

const PROMPT_BASE = `Crie UMA ÚNICA frase curta de efeito para post de grupo de promoção no WhatsApp, em CAIXA ALTA, com humor, no máximo 8 palavras. A frase deve fazer sentido para a categoria/uso real do produto (nada de reaproveitar o tema de outro exemplo sem relação). NÃO repita o nome do produto. NÃO invente garantias ou informações falsas. Responda só com a frase, sem lista, sem marcadores, sem explicação.

Exemplos:
Produto: fone de ouvido bluetooth -> SEUS OUVIDOS AGRADECEM
Produto: cadeira gamer -> SENTA QUE LÁ VEM CONFORTO
Produto: notebook pra trabalho -> BORA RENDER NO ESCRITÓRIO
Produto: relogio casio -> NUNCA MAIS CHEGUE ATRASADO

Produto: `;

function limparResposta(texto: string): string {
  const primeiraLinha = texto
    .trim()
    .split("\n")
    .map((linha) => linha.trim())
    .find((linha) => linha.length > 0) ?? "";

  return primeiraLinha
    .replace(/^[*\-•\d.)\s]+/, "")
    .replace(/^["'-]+|["'.]+$/g, "")
    .trim();
}

export async function gerarChamada(tituloProduto: string): Promise<string> {
  const resposta = await fetch(`${env.ollama.url}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.ollama.modelo,
      prompt: `${PROMPT_BASE}${tituloProduto} ->`,
      stream: false,
      options: { temperature: 0.6 },
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`Falha ao gerar chamada via Ollama (${resposta.status}): ${corpo}`);
  }

  const dados = (await resposta.json()) as { response: string };
  return limparResposta(dados.response);
}
