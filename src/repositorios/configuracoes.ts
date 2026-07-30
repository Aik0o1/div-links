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

/**
 * Link fixo de cupons da Shopee do próprio usuário — usado como o link de
 * "resgatar o cupom" mostrado em produto Shopee de grupo monitorado, no
 * lugar do link de ativação específico raspado do post original. Decisão
 * explícita do usuário: o link do post é de rastreamento de OUTRO afiliado
 * (o do grupo monitorado), então usar ele faria a comissão do cupom ir pro
 * dono do grupo, não pro usuário — sempre usa o link próprio, mesmo que
 * genérico (não específico daquele produto).
 */
export async function obterLinkCupomShopeeFixo(): Promise<string | null> {
  return obter("link_cupom_shopee_fixo");
}

export async function definirLinkCupomShopeeFixo(link: string): Promise<void> {
  await definir("link_cupom_shopee_fixo", link);
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

/**
 * Última plataforma de captura em massa (ML ou Shopee) escolhida no disparo
 * automático — usada pra intercalar entre as duas em vez de FIFO estrito por
 * `criado_em` (ver proximoProdutoElegivel em dispararProduto.ts). Sem isso,
 * uma leva de captura mais antiga de uma plataforma monopoliza a fila
 * inteira enquanto a outra nunca sai (bug real: leva de Shopee travando o ML
 * por horas). Não afeta produto de grupo monitorado, que sempre fura fila.
 */
export async function obterUltimaPlataformaBulkEnviada(): Promise<string | null> {
  return obter("ultima_plataforma_bulk_enviada");
}

export async function definirUltimaPlataformaBulkEnviada(plataforma: string): Promise<void> {
  await definir("ultima_plataforma_bulk_enviada", plataforma);
}

export interface ShopeeConfig {
  appId: string;
  secret: string;
}

/** Credenciais da API de afiliados da Shopee, configuráveis pela UI (Config. Afiliados). */
export async function obterShopeeConfig(): Promise<ShopeeConfig | null> {
  const valor = await obter("shopee_config");
  return valor ? (JSON.parse(valor) as ShopeeConfig) : null;
}

export async function definirShopeeConfig(config: ShopeeConfig): Promise<void> {
  await definir("shopee_config", JSON.stringify(config));
}
