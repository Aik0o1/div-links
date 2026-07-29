export async function api<T = any>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api${caminho}`, {
    headers: { "Content-Type": "application/json" },
    ...opcoes,
  });
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    throw new Error(corpo.erro || `Erro ${resposta.status}`);
  }
  if (resposta.status === 204) return null as T;
  return resposta.json();
}

export function formatarPreco(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MAPA_ERRO_AMIGAVEL: [RegExp, string][] = [
  [/evolution/i, "Não consegui falar com o WhatsApp (Evolution API)."],
  [/whatsapp/i, "Problema na conexão com o WhatsApp."],
  [/shopee/i, "Problema com a configuração/API da Shopee."],
  [/telegram/i, "Problema na conexão com o Telegram."],
  [/chrome|playwright|cdp/i, "Problema com o Chrome usado para gerar links do Mercado Livre."],
  [/timeout|timed out|etimedout/i, "A operação demorou demais e foi cancelada (timeout)."],
  [/econnrefused|fetch failed|network/i, "Não consegui me conectar a um serviço necessário."],
  [/404/, "Recurso não encontrado."],
  [/401|403/, "Sem permissão para essa ação."],
  [/500/, "Erro interno do servidor."],
];

export function mensagemAmigavel(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro ?? "Erro desconhecido");
  for (const [padrao, prefixo] of MAPA_ERRO_AMIGAVEL) {
    if (padrao.test(texto)) return `${prefixo} (${texto})`;
  }
  return texto;
}
