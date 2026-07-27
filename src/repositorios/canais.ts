import { pool } from "../db/pool.js";

export interface CanalRow {
  id: number;
  nome: string | null;
  tipo: "whatsapp" | "telegram";
  identificadorGrupo: string;
  categoriasPermitidas: string[] | null;
  descontoMinimo: number;
  intervaloMinimoMinutos: number;
  ativo: boolean;
}

function paraCanal(row: any): CanalRow {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    identificadorGrupo: row.identificador_grupo,
    categoriasPermitidas: row.categorias_permitidas,
    descontoMinimo: Number(row.desconto_minimo),
    intervaloMinimoMinutos: row.intervalo_minimo_minutos,
    ativo: row.ativo,
  };
}

export async function listar(): Promise<CanalRow[]> {
  const { rows } = await pool.query("SELECT * FROM canais_destino ORDER BY id");
  return rows.map(paraCanal);
}

export async function buscarPorId(id: number): Promise<CanalRow | null> {
  const { rows } = await pool.query("SELECT * FROM canais_destino WHERE id = $1", [id]);
  return rows[0] ? paraCanal(rows[0]) : null;
}

export async function criar(dados: {
  nome?: string | null;
  tipo: "whatsapp" | "telegram";
  identificadorGrupo: string;
  categoriasPermitidas?: string[] | null;
  descontoMinimo?: number;
  intervaloMinimoMinutos?: number;
}): Promise<CanalRow> {
  const { rows } = await pool.query(
    `INSERT INTO canais_destino (nome, tipo, identificador_grupo, categorias_permitidas, desconto_minimo, intervalo_minimo_minutos)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      dados.nome ?? null,
      dados.tipo,
      dados.identificadorGrupo,
      dados.categoriasPermitidas ?? null,
      dados.descontoMinimo ?? 0,
      dados.intervaloMinimoMinutos ?? 15,
    ],
  );
  return paraCanal(rows[0]);
}

export async function atualizar(
  id: number,
  dados: Partial<{
    nome: string | null;
    identificadorGrupo: string;
    categoriasPermitidas: string[] | null;
    descontoMinimo: number;
    intervaloMinimoMinutos: number;
    ativo: boolean;
  }>,
): Promise<CanalRow | null> {
  const { rows } = await pool.query(
    `UPDATE canais_destino SET
       nome = COALESCE($2, nome),
       identificador_grupo = COALESCE($3, identificador_grupo),
       categorias_permitidas = COALESCE($4, categorias_permitidas),
       desconto_minimo = COALESCE($5, desconto_minimo),
       intervalo_minimo_minutos = COALESCE($6, intervalo_minimo_minutos),
       ativo = COALESCE($7, ativo)
     WHERE id = $1
     RETURNING *`,
    [
      id,
      dados.nome ?? null,
      dados.identificadorGrupo ?? null,
      dados.categoriasPermitidas ?? null,
      dados.descontoMinimo ?? null,
      dados.intervaloMinimoMinutos ?? null,
      dados.ativo ?? null,
    ],
  );
  return rows[0] ? paraCanal(rows[0]) : null;
}

export async function remover(id: number): Promise<void> {
  await pool.query("DELETE FROM canais_destino WHERE id = $1", [id]);
}
