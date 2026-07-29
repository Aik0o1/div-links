import { pool } from "../db/pool.js";

export interface NichoRow {
  id: string;
  nome: string;
  categoriaIds: string[];
  ativo: boolean;
}

function paraNicho(row: {
  id: string;
  nome: string;
  categoria_ids: string[];
  ativo: boolean;
}): NichoRow {
  return {
    id: row.id,
    nome: row.nome,
    categoriaIds: row.categoria_ids,
    ativo: row.ativo,
  };
}

export async function listar(): Promise<NichoRow[]> {
  const { rows } = await pool.query(
    "SELECT id, nome, categoria_ids, ativo FROM nichos ORDER BY nome",
  );
  return rows.map(paraNicho);
}

export async function buscarPorId(id: string): Promise<NichoRow | null> {
  const { rows } = await pool.query(
    "SELECT id, nome, categoria_ids, ativo FROM nichos WHERE id = $1",
    [id],
  );
  return rows[0] ? paraNicho(rows[0]) : null;
}

export async function ativos(): Promise<NichoRow[]> {
  const { rows } = await pool.query(
    "SELECT id, nome, categoria_ids, ativo FROM nichos WHERE ativo = true ORDER BY nome",
  );
  return rows.map(paraNicho);
}

export async function criar(dados: {
  id: string;
  nome: string;
  categoriaIds: string[];
}): Promise<NichoRow> {
  const { rows } = await pool.query(
    "INSERT INTO nichos (id, nome, categoria_ids) VALUES ($1, $2, $3) RETURNING id, nome, categoria_ids, ativo",
    [dados.id, dados.nome, dados.categoriaIds],
  );
  return paraNicho(rows[0]);
}

export async function atualizar(
  id: string,
  dados: Partial<{ nome: string; categoriaIds: string[]; ativo: boolean }>,
): Promise<NichoRow | null> {
  const { rows } = await pool.query(
    `UPDATE nichos SET
       nome = COALESCE($2, nome),
       categoria_ids = COALESCE($3, categoria_ids),
       ativo = COALESCE($4, ativo)
     WHERE id = $1
     RETURNING id, nome, categoria_ids, ativo`,
    [id, dados.nome ?? null, dados.categoriaIds ?? null, dados.ativo ?? null],
  );
  return rows[0] ? paraNicho(rows[0]) : null;
}

export async function remover(id: string): Promise<void> {
  await pool.query("DELETE FROM nichos WHERE id = $1", [id]);
}
