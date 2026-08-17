import { createHash } from "node:crypto";
import { pool } from "../db/pool.js";

export interface ProdutoRow {
  id: number;
  fonte: string;
  urlOriginal: string;
  urlAfiliado: string | null;
  titulo: string | null;
  precoOriginal: number | null;
  precoPromocional: number | null;
  imagemUrl: string | null;
  cupom: string | null;
  nicho: string | null;
  chamada: string | null;
  precoNoPix: boolean;
  status: string;
  criadoEm: string;
  /** Id do grupo monitorado (WhatsApp JID ou Telegram chat id) que originou esse produto — null pra captura em massa ML/Shopee. */
  grupoOrigemId: string | null;
  /** Link de ativação do cupom no anúncio (Shopee via grupo monitorado, quando o post trazia 2 links) — distinto do link de afiliado do produto. */
  linkCupom: string | null;
}

export interface NovoProduto {
  fonte: string;
  urlOriginal: string;
  titulo: string;
  precoOriginal?: number;
  precoPromocional?: number;
  imagemUrl?: string;
  cupom?: string;
  nicho: string;
  precoNoPix?: boolean;
  /** Só quando a fonte já entrega o link de afiliado pronto (ex.: `productOfferV2` da Shopee) — pula a geração no disparo. */
  urlAfiliado?: string;
  /** Só pra captura via grupo monitorado — ver ProdutoRow.grupoOrigemId. */
  grupoOrigemId?: string;
  /** Ver ProdutoRow.linkCupom. */
  linkCupom?: string;
  /** Texto de chamada/impacto do post original de grupo monitorado (ver extrairChamada) — quando ausente, disparo pode gerar uma por IA (ver dispararProduto.ts). */
  chamada?: string;
}

function paraProduto(row: any): ProdutoRow {
  return {
    id: row.id,
    fonte: row.fonte,
    urlOriginal: row.url_original,
    urlAfiliado: row.url_afiliado,
    titulo: row.titulo,
    precoOriginal: row.preco_original !== null ? Number(row.preco_original) : null,
    precoPromocional:
      row.preco_promocional !== null ? Number(row.preco_promocional) : null,
    imagemUrl: row.imagem_url,
    cupom: row.cupom,
    nicho: row.nicho,
    chamada: row.chamada,
    precoNoPix: row.preco_no_pix,
    status: row.status,
    criadoEm: row.criado_em,
    grupoOrigemId: row.grupo_origem_id,
    linkCupom: row.link_cupom,
  };
}

// Inclui o nicho no hash de propósito: o mesmo produto real pode existir uma vez
// por nicho (ex.: "tecnologia" e "geral" ao mesmo tempo), já que servem canais/públicos
// diferentes. Só é duplicado de verdade se já existir NO MESMO nicho.
//
// NÃO inclui preço — chegou a incluir, mas causava duplicata real: se a mesma
// url/mensagem fosse processada duas vezes (ex.: raspagem lenta demorando
// mais que o intervalo do agendador) e uma das tentativas falhasse em
// extrair o preço (concorrência por recursos do Chrome), o hash saía
// diferente e a segunda tentativa não era pega como duplicada — postava a
// mesma oferta duas vezes, uma delas sem preço nenhum.
//
// NÃO inclui usuarioId — a unicidade por tenant é feita pela constraint
// (usuario_id, hash_conteudo), não pelo hash em si (dois tenants capturando
// o mesmo produto real geram o MESMO hash, de propósito, e não colidem
// porque a constraint já é composta).
function calcularHash(produto: NovoProduto): string {
  const base = `${produto.titulo}|${produto.urlOriginal}|${produto.nicho}`;
  return createHash("sha1").update(base).digest("hex");
}

// `NaN` nunca é um preço válido pra gravar — vira "R$ NaN" na legenda
// enviada (bug real reportado pelo usuário). Alguma extração de preço com
// bug (já corrigido, ou uma futura ainda não vista) pode produzir NaN em vez
// de null/undefined; trata como "sem preço" (null) em vez de deixar passar
// pro banco, que aceita NaN de boa num campo numeric.
function precoValido(valor: number | undefined): number | null {
  return valor !== undefined && !Number.isNaN(valor) ? valor : null;
}

/** Retorna null se o produto já existir pra esse tenant (deduplicado por (usuario_id, hash_conteudo)). */
export async function inserirSeNovo(usuarioId: number, produto: NovoProduto): Promise<ProdutoRow | null> {
  const hash = calcularHash(produto);

  const { rows } = await pool.query(
    `INSERT INTO produtos (usuario_id, fonte, url_original, titulo, preco_original, preco_promocional, imagem_url, cupom, nicho, preco_no_pix, url_afiliado, hash_conteudo, grupo_origem_id, link_cupom, chamada)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (usuario_id, hash_conteudo) DO NOTHING
     RETURNING *`,
    [
      usuarioId,
      produto.fonte,
      produto.urlOriginal,
      produto.titulo,
      precoValido(produto.precoOriginal),
      precoValido(produto.precoPromocional),
      produto.imagemUrl ?? null,
      produto.cupom ?? null,
      produto.nicho,
      produto.precoNoPix ?? false,
      produto.urlAfiliado ?? null,
      hash,
      produto.grupoOrigemId ?? null,
      produto.linkCupom ?? null,
      produto.chamada ?? null,
    ],
  );

  return rows[0] ? paraProduto(rows[0]) : null;
}

export async function listar(
  usuarioId: number,
  filtro?: {
    status?: string;
    nicho?: string;
    fonte?: "mercado_livre" | "shopee" | "monitorados";
  },
): Promise<ProdutoRow[]> {
  const condicoes: string[] = ["usuario_id = $1"];
  const valores: unknown[] = [usuarioId];

  if (filtro?.status) {
    valores.push(filtro.status);
    condicoes.push(`status = $${valores.length}`);
  }
  if (filtro?.nicho) {
    valores.push(filtro.nicho);
    condicoes.push(`nicho = $${valores.length}`);
  }
  if (filtro?.fonte === "monitorados") {
    condicoes.push(
      `fonte IN ('telegram_terceiros', 'whatsapp_terceiros', 'telegram_shopee', 'whatsapp_shopee')`,
    );
  } else if (filtro?.fonte === "mercado_livre") {
    condicoes.push(`fonte = 'mercado_livre'`);
  } else if (filtro?.fonte === "shopee") {
    condicoes.push(`fonte IN ('shopee', 'telegram_shopee', 'whatsapp_shopee')`);
  }

  const { rows } = await pool.query(
    `SELECT * FROM produtos WHERE ${condicoes.join(" AND ")} ORDER BY criado_em DESC LIMIT 1000`,
    valores,
  );
  return rows.map(paraProduto);
}

/** Mais antigo primeiro (FIFO), pra ciclar pelos produtos ao longo do tempo. */
// Produtos de grupo monitorado (Telegram ou WhatsApp, ML ou Shopee) furam a
// fila (promoção/cupom costuma ser sensível a tempo) — vêm sempre antes dos
// demais, mas entre si continuam FIFO (mais antigo primeiro). Produtos de
// outras fontes (captura em massa, ML ou Shopee) seguem FIFO entre si.
//
// `nichos: null` = sem filtro de nicho (canal "geral", sem categorias
// definidas, aceita produto de qualquer nicho — ver nichoElegivel em
// dispararProduto.ts).
const FONTE_PRIORITARIA = "'telegram_terceiros', 'whatsapp_terceiros', 'telegram_shopee', 'whatsapp_shopee'";

/**
 * `gruposPermitidos` alarga o filtro de nicho: além do que bate em `nichos`,
 * também traz produto de grupo monitorado cujo `grupo_origem_id` esteja
 * nessa lista, mesmo que o nicho dele não esteja em `nichos` — é a metade
 * "alargar" do bypass de nicho por allow-list de grupo (ver
 * grupoMonitoradoStatus em dispararProduto.ts; a outra metade, "estreitar"
 * pra excluir grupo bloqueado que bateu no nicho por coincidência, é feita
 * em JS por quem chama essa função). Ordem de prioridade (grupo monitorado
 * primeiro) não muda em nenhum dos dois casos.
 *
 * Só considera produto capturado HOJE (fuso America/Sao_Paulo) — usada pelo
 * disparo AUTOMÁTICO (proximoProdutoElegivel), nunca pela aba Produtos
 * (listar(), sem esse filtro, continua mostrando tudo pro usuário escolher
 * manualmente). Pedido explícito do usuário: produto capturado ontem e
 * nunca disparado (ex.: fila que empacou, canal ficou inativo um dia) não
 * deve furar pra hoje com preço/promoção potencialmente vencidos — melhor
 * ficar parado esperando alguém decidir manualmente do que sair sozinho.
 */
export async function listarPorNichos(
  usuarioId: number,
  nichos: string[] | null,
  status: string,
  gruposPermitidos?: string[] | null,
): Promise<ProdutoRow[]> {
  const FILTRO_HOJE = `criado_em AT TIME ZONE 'America/Sao_Paulo' >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')`;

  if (nichos === null) {
    const { rows } = await pool.query(
      `SELECT * FROM produtos WHERE usuario_id = $1 AND status = $2 AND ${FILTRO_HOJE}
       ORDER BY (fonte IN (${FONTE_PRIORITARIA})) DESC, criado_em ASC`,
      [usuarioId, status],
    );
    return rows.map(paraProduto);
  }

  const { rows } = await pool.query(
    `SELECT * FROM produtos
     WHERE usuario_id = $1 AND status = $3 AND ${FILTRO_HOJE}
       AND (nicho = ANY($2) OR ($4::text[] IS NOT NULL AND grupo_origem_id = ANY($4)))
     ORDER BY (fonte IN (${FONTE_PRIORITARIA})) DESC, criado_em ASC`,
    [usuarioId, nichos, status, gruposPermitidos && gruposPermitidos.length > 0 ? gruposPermitidos : null],
  );
  return rows.map(paraProduto);
}

export async function buscarPorId(usuarioId: number, id: number): Promise<ProdutoRow | null> {
  const { rows } = await pool.query("SELECT * FROM produtos WHERE id = $1 AND usuario_id = $2", [id, usuarioId]);
  return rows[0] ? paraProduto(rows[0]) : null;
}

/** Remove os produtos ainda não disparados desse tenant (usado antes de uma nova captura, pra substituir a leva anterior). */
export async function removerTodos(usuarioId: number): Promise<void> {
  await pool.query("DELETE FROM produtos WHERE usuario_id = $1", [usuarioId]);
}

/**
 * Wipe escopado a um nicho+fonte só (desse tenant) — usado pela captura por
 * aba (ver capturarProdutosPorNicho em capturarProdutos.ts), pra recapturar
 * só aquela categoria sem apagar os outros nichos nem a Shopee. Diferente de
 * removerTodos(), que apaga todos os produtos do tenant.
 */
export async function removerPorNichoEFonte(usuarioId: number, nicho: string, fonte: string): Promise<void> {
  await pool.query("DELETE FROM produtos WHERE usuario_id = $1 AND nicho = $2 AND fonte = $3", [
    usuarioId,
    nicho,
    fonte,
  ]);
}

export async function remover(usuarioId: number, id: number): Promise<void> {
  await pool.query("DELETE FROM produtos WHERE id = $1 AND usuario_id = $2", [id, usuarioId]);
}

export async function atualizarStatus(
  usuarioId: number,
  id: number,
  status: string,
  urlAfiliado?: string,
): Promise<void> {
  await pool.query(
    "UPDATE produtos SET status = $3, url_afiliado = COALESCE($4, url_afiliado) WHERE id = $1 AND usuario_id = $2",
    [id, usuarioId, status, urlAfiliado ?? null],
  );
}

export async function atualizarChamada(usuarioId: number, id: number, chamada: string): Promise<void> {
  await pool.query("UPDATE produtos SET chamada = $3 WHERE id = $1 AND usuario_id = $2", [id, usuarioId, chamada]);
}

/** Produtos capturados "hoje" (fuso America/Sao_Paulo), qualquer status, desse tenant — card do Dashboard. */
export async function contarCapturadosHoje(usuarioId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*) AS total FROM produtos
     WHERE usuario_id = $1
       AND criado_em AT TIME ZONE 'America/Sao_Paulo' >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')`,
    [usuarioId],
  );
  return Number(rows[0].total);
}

/**
 * Fila pendente — total agregado de produtos "capturado" desse tenant
 * esperando disparo. Não é por canal (reproduzir a elegibilidade de canal em
 * SQL duplicaria a regra de negócio que já existe em dispararProduto.ts) —
 * só um número geral pro card do Dashboard.
 */
export async function contarPendentes(usuarioId: number): Promise<number> {
  const { rows } = await pool.query(`SELECT count(*) AS total FROM produtos WHERE usuario_id = $1 AND status = 'capturado'`, [
    usuarioId,
  ]);
  return Number(rows[0].total);
}
