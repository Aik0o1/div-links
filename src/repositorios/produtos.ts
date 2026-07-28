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
  };
}

// Inclui o nicho no hash de propósito: o mesmo produto real pode existir uma vez
// por nicho (ex.: "tecnologia" e "geral" ao mesmo tempo), já que servem canais/públicos
// diferentes. Só é duplicado de verdade se já existir NO MESMO nicho.
function calcularHash(produto: NovoProduto): string {
  const base = `${produto.titulo}|${produto.precoPromocional ?? produto.precoOriginal ?? ""}|${produto.urlOriginal}|${produto.nicho}`;
  return createHash("sha1").update(base).digest("hex");
}

/** Retorna null se o produto já existir (deduplicado por hash_conteudo). */
export async function inserirSeNovo(produto: NovoProduto): Promise<ProdutoRow | null> {
  const hash = calcularHash(produto);

  const { rows } = await pool.query(
    `INSERT INTO produtos (fonte, url_original, titulo, preco_original, preco_promocional, imagem_url, cupom, nicho, preco_no_pix, hash_conteudo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      hash,
    ],
  );

  return rows[0] ? paraProduto(rows[0]) : null;
}

export async function listar(filtro?: {
  status?: string;
  nicho?: string;
  fonte?: "mercado_livre" | "monitorados";
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
    condicoes.push(`fonte IN ('telegram_terceiros', 'whatsapp_terceiros')`);
  } else if (filtro?.fonte === "mercado_livre") {
    condicoes.push(`fonte = 'mercado_livre'`);
  }

  const where = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT * FROM produtos ${where} ORDER BY criado_em DESC LIMIT 1000`,
    valores,
  );
  return rows.map(paraProduto);
}

/** Mais antigo primeiro (FIFO), pra ciclar pelos produtos ao longo do tempo. */
// Produtos de grupo monitorado (Telegram ou WhatsApp) furam a fila
// (promoção/cupom costuma ser sensível a tempo) — vêm sempre antes dos
// demais, mas entre si continuam FIFO (mais antigo primeiro). Produtos de
// outras fontes (captura do ML) seguem FIFO entre si.
export async function listarPorNichos(nichos: string[], status: string): Promise<ProdutoRow[]> {
  const { rows } = await pool.query(
    `SELECT * FROM produtos WHERE nicho = ANY($1) AND status = $2
     ORDER BY (fonte IN ('telegram_terceiros', 'whatsapp_terceiros')) DESC, criado_em ASC`,
    [nichos, status],
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
