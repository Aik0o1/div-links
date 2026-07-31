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
function calcularHash(produto: NovoProduto): string {
  const base = `${produto.titulo}|${produto.urlOriginal}|${produto.nicho}`;
  return createHash("sha1").update(base).digest("hex");
}

/** Retorna null se o produto já existir (deduplicado por hash_conteudo). */
export async function inserirSeNovo(produto: NovoProduto): Promise<ProdutoRow | null> {
  const hash = calcularHash(produto);

  const { rows } = await pool.query(
    `INSERT INTO produtos (fonte, url_original, titulo, preco_original, preco_promocional, imagem_url, cupom, nicho, preco_no_pix, url_afiliado, hash_conteudo, grupo_origem_id, link_cupom, chamada)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (hash_conteudo) DO NOTHING
     RETURNING *`,
    [
      produto.fonte,
      produto.urlOriginal,
      produto.titulo,
      produto.precoOriginal ?? null,
      produto.precoPromocional ?? null,
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

export async function listar(filtro?: {
  status?: string;
  nicho?: string;
  fonte?: "mercado_livre" | "shopee" | "monitorados";
}): Promise<ProdutoRow[]> {
  const condicoes: string[] = [];
  const valores: string[] = [];

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

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT * FROM produtos ${where} ORDER BY criado_em DESC LIMIT 1000`,
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
 */
export async function listarPorNichos(
  nichos: string[] | null,
  status: string,
  gruposPermitidos?: string[] | null,
): Promise<ProdutoRow[]> {
  if (nichos === null) {
    const { rows } = await pool.query(
      `SELECT * FROM produtos WHERE status = $1
       ORDER BY (fonte IN (${FONTE_PRIORITARIA})) DESC, criado_em ASC`,
      [status],
    );
    return rows.map(paraProduto);
  }

  const { rows } = await pool.query(
    `SELECT * FROM produtos
     WHERE status = $2 AND (nicho = ANY($1) OR ($3::text[] IS NOT NULL AND grupo_origem_id = ANY($3)))
     ORDER BY (fonte IN (${FONTE_PRIORITARIA})) DESC, criado_em ASC`,
    [nichos, status, gruposPermitidos && gruposPermitidos.length > 0 ? gruposPermitidos : null],
  );
  return rows.map(paraProduto);
}

export async function buscarPorId(id: number): Promise<ProdutoRow | null> {
  const { rows } = await pool.query("SELECT * FROM produtos WHERE id = $1", [id]);
  return rows[0] ? paraProduto(rows[0]) : null;
}

/** Remove os produtos ainda não disparados (usado antes de uma nova captura, pra substituir a leva anterior). */
export async function removerTodos(): Promise<void> {
  await pool.query("DELETE FROM produtos");
}

/**
 * Wipe escopado a um nicho+fonte só — usado pela captura por aba (ver
 * capturarProdutosPorNicho em capturarProdutos.ts), pra recapturar só aquela
 * categoria sem apagar os outros nichos nem a Shopee. Diferente de
 * removerTodos(), que apaga a tabela inteira (só usado no "Limpar todos" e
 * na captura ML global via CLI/rota sem nicho).
 */
export async function removerPorNichoEFonte(nicho: string, fonte: string): Promise<void> {
  await pool.query("DELETE FROM produtos WHERE nicho = $1 AND fonte = $2", [nicho, fonte]);
}

export async function remover(id: number): Promise<void> {
  await pool.query("DELETE FROM produtos WHERE id = $1", [id]);
}

export async function atualizarStatus(
  id: number,
  status: string,
  urlAfiliado?: string,
): Promise<void> {
  await pool.query(
    "UPDATE produtos SET status = $2, url_afiliado = COALESCE($3, url_afiliado) WHERE id = $1",
    [id, status, urlAfiliado ?? null],
  );
}

export async function atualizarChamada(id: number, chamada: string): Promise<void> {
  await pool.query("UPDATE produtos SET chamada = $2 WHERE id = $1", [id, chamada]);
}

/** Produtos capturados "hoje" (fuso America/Sao_Paulo), qualquer status — card do Dashboard. */
export async function contarCapturadosHoje(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*) AS total FROM produtos
     WHERE criado_em AT TIME ZONE 'America/Sao_Paulo' >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')`,
  );
  return Number(rows[0].total);
}

/**
 * Fila pendente — total agregado de produtos "capturado" esperando disparo.
 * Não é por canal (reproduzir a elegibilidade de canal em SQL duplicaria a
 * regra de negócio que já existe em dispararProduto.ts) — só um número geral
 * pro card do Dashboard.
 */
export async function contarPendentes(): Promise<number> {
  const { rows } = await pool.query(`SELECT count(*) AS total FROM produtos WHERE status = 'capturado'`);
  return Number(rows[0].total);
}
