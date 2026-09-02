import { pool } from "../db/pool.js";
import { criptografarConfig, descriptografarConfig } from "../config/criptografiaConfig.js";

async function obter(usuarioId: number, chave: string): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT valor FROM configuracoes WHERE usuario_id = $1 AND chave = $2",
    [usuarioId, chave],
  );
  return rows[0]?.valor ?? null;
}

async function definir(usuarioId: number, chave: string, valor: string): Promise<void> {
  await pool.query(
    `INSERT INTO configuracoes (usuario_id, chave, valor) VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id, chave) DO UPDATE SET valor = EXCLUDED.valor`,
    [usuarioId, chave, valor],
  );
}

export async function obterDisparoAutomaticoAtivo(usuarioId: number): Promise<boolean> {
  const valor = await obter(usuarioId, "disparo_automatico_ativo");
  return valor === "true";
}

export async function definirDisparoAutomaticoAtivo(usuarioId: number, ativo: boolean): Promise<void> {
  await definir(usuarioId, "disparo_automatico_ativo", String(ativo));
}

/**
 * Criptografada em repouso (ver config/criptografiaConfig.ts) — é a sessão
 * MTProto da conta pessoal do Telegram usada pra monitorar grupo de
 * terceiros, equivalente a uma credencial de login válida. Descriptografia
 * tolera valor legado em texto puro (salvo antes dessa mudança).
 */
export async function obterTelegramListenerSessao(usuarioId: number): Promise<string | null> {
  const valor = await obter(usuarioId, "telegram_listener_sessao");
  return valor ? descriptografarConfig(valor) : null;
}

export async function definirTelegramListenerSessao(usuarioId: number, sessao: string): Promise<void> {
  await definir(usuarioId, "telegram_listener_sessao", criptografarConfig(sessao));
}

export interface GrupoMonitoradoConfig {
  id: string;
  /** Nicho aplicado aos produtos capturados desse grupo (ver dispararProduto.ts / canais_destino.categorias_permitidas). */
  nicho: string;
  /** Nome de exibição do grupo (o painel já tem em mãos ao selecionar, ver GruposMonitorados.tsx) — usado só pra mostrar de qual grupo um produto veio na aba Produtos (ProdutoCard.tsx). Ausente em seleção salva antes dessa mudança, some sozinho ao salvar de novo. */
  nome?: string;
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
export async function obterTelegramListenerGrupos(usuarioId: number): Promise<GrupoMonitoradoConfig[]> {
  const valor = await obter(usuarioId, "telegram_listener_grupos");
  if (valor) return migrarGruposMonitorados(valor);

  const grupoUnicoAntigo = await obter(usuarioId, "telegram_listener_grupo_id");
  return grupoUnicoAntigo ? [{ id: grupoUnicoAntigo, nicho: "geral" }] : [];
}

export async function definirTelegramListenerGrupos(usuarioId: number, grupos: GrupoMonitoradoConfig[]): Promise<void> {
  await definir(usuarioId, "telegram_listener_grupos", JSON.stringify(grupos));
}

/** Último ID de mensagem já processado por grupo do Telegram (usado pelo polling, evita reprocessar). */
export async function obterTelegramUltimosIds(usuarioId: number): Promise<Record<string, number>> {
  const valor = await obter(usuarioId, "telegram_listener_ultimos_ids");
  return valor ? JSON.parse(valor) : {};
}

export async function definirTelegramUltimoId(usuarioId: number, grupoId: string, msgId: number): Promise<void> {
  const atual = await obterTelegramUltimosIds(usuarioId);
  atual[grupoId] = msgId;
  await definir(usuarioId, "telegram_listener_ultimos_ids", JSON.stringify(atual));
}

/** Link fixo (ex.: lista de recomendações do ML) colocado no final da legenda dos cupons repassados. */
export async function obterLinkCupomFixo(usuarioId: number): Promise<string | null> {
  return obter(usuarioId, "link_cupom_fixo");
}

export async function definirLinkCupomFixo(usuarioId: number, link: string): Promise<void> {
  await definir(usuarioId, "link_cupom_fixo", link);
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
export async function obterLinkCupomShopeeFixo(usuarioId: number): Promise<string | null> {
  return obter(usuarioId, "link_cupom_shopee_fixo");
}

export async function definirLinkCupomShopeeFixo(usuarioId: number, link: string): Promise<void> {
  await definir(usuarioId, "link_cupom_shopee_fixo", link);
}

/** Grupos do WhatsApp monitorados (mesmo conceito da lista do Telegram, seção 2.7/2.8). */
export async function obterWhatsappGruposMonitorados(usuarioId: number): Promise<GrupoMonitoradoConfig[]> {
  const valor = await obter(usuarioId, "whatsapp_grupos_monitorados");
  return migrarGruposMonitorados(valor);
}

export async function definirWhatsappGruposMonitorados(usuarioId: number, grupos: GrupoMonitoradoConfig[]): Promise<void> {
  await definir(usuarioId, "whatsapp_grupos_monitorados", JSON.stringify(grupos));
}

/** Se desativado, o disparo (manual ou automático) não chama o Ollama pra gerar a chamada — vai sem ela. */
export async function obterChamadaIAAtiva(usuarioId: number): Promise<boolean> {
  const valor = await obter(usuarioId, "chamada_ia_ativa");
  return valor !== "false"; // default ligado (comportamento histórico)
}

export async function definirChamadaIAAtiva(usuarioId: number, ativa: boolean): Promise<void> {
  await definir(usuarioId, "chamada_ia_ativa", String(ativa));
}

/**
 * Última plataforma de captura em massa (ML ou Shopee) escolhida no disparo
 * automático — usada pra intercalar entre as duas em vez de FIFO estrito por
 * `criado_em` (ver proximoProdutoElegivel em dispararProduto.ts). Sem isso,
 * uma leva de captura mais antiga de uma plataforma monopoliza a fila
 * inteira enquanto a outra nunca sai (bug real: leva de Shopee travando o ML
 * por horas). Não afeta produto de grupo monitorado, que sempre fura fila.
 */
export async function obterUltimaPlataformaBulkEnviada(usuarioId: number): Promise<string | null> {
  return obter(usuarioId, "ultima_plataforma_bulk_enviada");
}

export async function definirUltimaPlataformaBulkEnviada(usuarioId: number, plataforma: string): Promise<void> {
  await definir(usuarioId, "ultima_plataforma_bulk_enviada", plataforma);
}

export interface ShopeeConfig {
  appId: string;
  secret: string;
}

/** Credenciais da API de afiliados da Shopee, configuráveis pela UI (Config. Afiliados). */
export async function obterShopeeConfig(usuarioId: number): Promise<ShopeeConfig | null> {
  const valor = await obter(usuarioId, "shopee_config");
  return valor ? (JSON.parse(valor) as ShopeeConfig) : null;
}

export async function definirShopeeConfig(usuarioId: number, config: ShopeeConfig): Promise<void> {
  await definir(usuarioId, "shopee_config", JSON.stringify(config));
}

/**
 * Cookie de sessão logada do Mercado Livre (conta de afiliado) — usado pra
 * raspar página real de produto/ofertas via HTTP puro, sem Chrome (ver
 * meliHttp.ts). Expira periodicamente (igual qualquer sessão web); quando
 * expirar, a raspagem passa a falhar com erro claro pedindo pra atualizar
 * aqui. Fica no banco (não no .env) porque precisa poder ser atualizado sem
 * reiniciar o processo. Criptografado em repouso (ver
 * config/criptografiaConfig.ts) — é equivalente a uma sessão logada de
 * verdade. Descriptografia tolera valor legado em texto puro.
 */
export async function obterMeliSessionCookie(usuarioId: number): Promise<string | null> {
  const valor = await obter(usuarioId, "meli_session_cookie");
  return valor ? descriptografarConfig(valor) : null;
}

export async function definirMeliSessionCookie(usuarioId: number, cookie: string): Promise<void> {
  await definir(usuarioId, "meli_session_cookie", criptografarConfig(cookie));
}

/**
 * Marca/limpa que a sessão do ML foi flagrada como expirada/bloqueada
 * (`SessaoMeliExpiradaError`, ver meliHttp.ts) — usado pra avisar na aba
 * Dashboard (pré-requisitos) mesmo quando isso acontece num fluxo em
 * segundo plano (captura de grupo monitorado), que só loga erro sem
 * ninguém necessariamente estar olhando o toast na hora. Marcado no
 * catch de quem chama o ML; limpo automaticamente na próxima chamada que
 * funcionar, ou ao salvar um cookie novo (ver rotas/afiliados.ts).
 */
export async function marcarMeliCookieExpirado(usuarioId: number): Promise<void> {
  await definir(usuarioId, "meli_cookie_expirado_em", new Date().toISOString());
}

export async function limparMeliCookieExpirado(usuarioId: number): Promise<void> {
  await pool.query("DELETE FROM configuracoes WHERE usuario_id = $1 AND chave = $2", [
    usuarioId,
    "meli_cookie_expirado_em",
  ]);
}

export async function obterMeliCookieExpirado(usuarioId: number): Promise<boolean> {
  return (await obter(usuarioId, "meli_cookie_expirado_em")) !== null;
}

export interface MeliAfiliadoConfig {
  /** Tag de afiliado (ex.: "seuusuario20220908145641") — vem junto de qualquer link gerado no painel de afiliados do ML, nunca muda. */
  tag: string;
}

/**
 * Tag de afiliado do Mercado Livre, configurável pela UI (Config.
 * Afiliados) — antes vinha fixa do `.env` (MELI_AFFILIATE_TAG), migrado pra
 * cá 2026-08-14 pra não precisar reiniciar o processo pra trocar, mesmo
 * padrão da config da Shopee.
 */
export async function obterMeliAfiliadoConfig(usuarioId: number): Promise<MeliAfiliadoConfig | null> {
  const valor = await obter(usuarioId, "meli_afiliado_config");
  return valor ? (JSON.parse(valor) as MeliAfiliadoConfig) : null;
}

export async function definirMeliAfiliadoConfig(usuarioId: number, config: MeliAfiliadoConfig): Promise<void> {
  await definir(usuarioId, "meli_afiliado_config", JSON.stringify(config));
}
