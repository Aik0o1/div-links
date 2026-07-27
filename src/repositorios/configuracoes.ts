import { pool } from "../db/pool.js";

async function obter(chave: string): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT valor FROM configuracoes WHERE chave = $1",
    [chave],
  );
  return rows[0]?.valor ?? null;
}

async function definir(chave: string, valor: string): Promise<void> {
  await pool.query(
    `INSERT INTO configuracoes (chave, valor) VALUES ($1, $2)
     ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`,
    [chave, valor],
  );
}

export async function obterDescontoMinimo(): Promise<number> {
  const valor = await obter("desconto_minimo");
  return Number(valor ?? "0");
}

export async function definirDescontoMinimo(valor: number): Promise<void> {
  await definir("desconto_minimo", String(valor));
}

export async function obterDisparoAutomaticoAtivo(): Promise<boolean> {
  const valor = await obter("disparo_automatico_ativo");
  return valor === "true";
}

export async function definirDisparoAutomaticoAtivo(ativo: boolean): Promise<void> {
  await definir("disparo_automatico_ativo", String(ativo));
}

export async function obterTelegramListenerSessao(): Promise<string | null> {
  return obter("telegram_listener_sessao");
}

export async function definirTelegramListenerSessao(sessao: string): Promise<void> {
  await definir("telegram_listener_sessao", sessao);
}

export interface GrupoMonitoradoConfig {
  id: string;
  /** Nicho aplicado aos produtos capturados desse grupo (ver dispararProduto.ts / canais_destino.categorias_permitidas). */
  nicho: string;
}

// Migra formatos antigos (string do grupo único, depois string[] de vários ids
// sem nicho) pro formato atual {id, nicho}[] sem exigir passo manual do usuário.
function migrarGruposMonitorados(valorBruto: string | null): GrupoMonitoradoConfig[] {
  if (!valorBruto) return [];
  const parsed = JSON.parse(valorBruto);
  if (Array.isArray(parsed) && (parsed.length === 0 || typeof parsed[0] === "string")) {
    return (parsed as string[]).map((id) => ({ id, nicho: "geral" }));
  }
  return parsed as GrupoMonitoradoConfig[];
}

/**
 * Lista de grupos monitorados do Telegram (substituiu o campo de grupo
 * único). Migra sozinho na primeira leitura tanto do valor antigo
 * `telegram_listener_grupo_id` (grupo único) quanto do formato intermediário
 * `string[]` (vários grupos, sem nicho).
 */
export async function obterTelegramListenerGrupos(): Promise<GrupoMonitoradoConfig[]> {
  const valor = await obter("telegram_listener_grupos");
  if (valor) return migrarGruposMonitorados(valor);

  const grupoUnicoAntigo = await obter("telegram_listener_grupo_id");
  return grupoUnicoAntigo ? [{ id: grupoUnicoAntigo, nicho: "geral" }] : [];
}

export async function definirTelegramListenerGrupos(grupos: GrupoMonitoradoConfig[]): Promise<void> {
  await definir("telegram_listener_grupos", JSON.stringify(grupos));
}

/** Último ID de mensagem já processado por grupo do Telegram (usado pelo polling, evita reprocessar). */
export async function obterTelegramUltimosIds(): Promise<Record<string, number>> {
  const valor = await obter("telegram_listener_ultimos_ids");
  return valor ? JSON.parse(valor) : {};
}

export async function definirTelegramUltimoId(grupoId: string, msgId: number): Promise<void> {
  const atual = await obterTelegramUltimosIds();
  atual[grupoId] = msgId;
  await definir("telegram_listener_ultimos_ids", JSON.stringify(atual));
}

/** Link fixo (ex.: lista de recomendações do ML) colocado no final da legenda dos cupons repassados. */
export async function obterLinkCupomFixo(): Promise<string | null> {
  return obter("link_cupom_fixo");
}

export async function definirLinkCupomFixo(link: string): Promise<void> {
  await definir("link_cupom_fixo", link);
}

/** Grupos do WhatsApp monitorados (mesmo conceito da lista do Telegram, seção 2.7/2.8). */
export async function obterWhatsappGruposMonitorados(): Promise<GrupoMonitoradoConfig[]> {
  const valor = await obter("whatsapp_grupos_monitorados");
  return migrarGruposMonitorados(valor);
}

export async function definirWhatsappGruposMonitorados(grupos: GrupoMonitoradoConfig[]): Promise<void> {
  await definir("whatsapp_grupos_monitorados", JSON.stringify(grupos));
}

/** Se desativado, o disparo (manual ou automático) não chama o Ollama pra gerar a chamada — vai sem ela. */
export async function obterChamadaIAAtiva(): Promise<boolean> {
  const valor = await obter("chamada_ia_ativa");
  return valor !== "false"; // default ligado (comportamento histórico)
}

export async function definirChamadaIAAtiva(ativa: boolean): Promise<void> {
  await definir("chamada_ia_ativa", String(ativa));
}
