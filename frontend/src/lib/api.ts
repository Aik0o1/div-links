// Disparado sempre que uma chamada à API volta 401 (sessão ausente/expirada)
// — `useSessao()` escuta esse evento pra derrubar o usuário de volta pro
// login sem precisar que cada página trate 401 na mão. Não dispara pras
// próprias rotas de /auth (login errado, por exemplo, também é 401, mas aí
// não faz sentido "deslogar" quem nem estava logado).
export const EVENTO_NAO_AUTENTICADO = "divulga-links:nao-autenticado";

// Disparado quando uma chamada à API volta 402 com `bloqueadoPorAssinatura`
// (ver middleware/assinatura.ts no backend) — trial vencido, pagamento
// atrasado, cancelada, etc. `useAssinatura()` escuta pra derrubar a tela
// pro bloqueio de assinatura mesmo que a checagem inicial (no load da
// página) não tivesse pego (ex.: trial venceu com o painel já aberto).
export const EVENTO_ASSINATURA_BLOQUEADA = "divulga-links:assinatura-bloqueada";

export async function api<T = any>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`/api${caminho}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opcoes,
  });
  if (resposta.status === 401 && !caminho.startsWith("/auth/")) {
    window.dispatchEvent(new Event(EVENTO_NAO_AUTENTICADO));
  }
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}));
    if (resposta.status === 402 && corpo.bloqueadoPorAssinatura) {
      window.dispatchEvent(new Event(EVENTO_ASSINATURA_BLOQUEADA));
    }
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
