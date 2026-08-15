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

export async function listar(usuarioId: number): Promise<NichoRow[]> {
  const { rows } = await pool.query(
    "SELECT id, nome, categoria_ids, ativo FROM nichos WHERE usuario_id = $1 ORDER BY nome",
    [usuarioId],
  );
  return rows.map(paraNicho);
}

export async function buscarPorId(usuarioId: number, id: string): Promise<NichoRow | null> {
  const { rows } = await pool.query(
    "SELECT id, nome, categoria_ids, ativo FROM nichos WHERE id = $1 AND usuario_id = $2",
    [id, usuarioId],
  );
  return rows[0] ? paraNicho(rows[0]) : null;
}

export async function ativos(usuarioId: number): Promise<NichoRow[]> {
  const { rows } = await pool.query(
    "SELECT id, nome, categoria_ids, ativo FROM nichos WHERE usuario_id = $1 AND ativo = true ORDER BY nome",
    [usuarioId],
  );
  return rows.map(paraNicho);
}

export async function criar(
  usuarioId: number,
  dados: {
    id: string;
    nome: string;
    categoriaIds: string[];
  },
): Promise<NichoRow> {
  const { rows } = await pool.query(
    "INSERT INTO nichos (usuario_id, id, nome, categoria_ids) VALUES ($1, $2, $3, $4) RETURNING id, nome, categoria_ids, ativo",
    [usuarioId, dados.id, dados.nome, dados.categoriaIds],
  );
  return paraNicho(rows[0]);
}

export async function atualizar(
  usuarioId: number,
  id: string,
  dados: Partial<{ nome: string; categoriaIds: string[]; ativo: boolean }>,
): Promise<NichoRow | null> {
  const { rows } = await pool.query(
    `UPDATE nichos SET
       nome = COALESCE($3, nome),
       categoria_ids = COALESCE($4, categoria_ids),
       ativo = COALESCE($5, ativo)
     WHERE id = $1 AND usuario_id = $2
     RETURNING id, nome, categoria_ids, ativo`,
    [id, usuarioId, dados.nome ?? null, dados.categoriaIds ?? null, dados.ativo ?? null],
  );
  return rows[0] ? paraNicho(rows[0]) : null;
}

export async function remover(usuarioId: number, id: string): Promise<void> {
  await pool.query("DELETE FROM nichos WHERE id = $1 AND usuario_id = $2", [id, usuarioId]);
}
