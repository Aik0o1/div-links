import { pool } from "../db/pool.js";

export interface UsuarioRow {
  id: number;
  email: string;
  senhaHash: string;
  nome: string | null;
  ativo: boolean;
  criadoEm: string;
}

function paraUsuario(row: any): UsuarioRow {
  return {
    id: row.id,
    email: row.email,
    senhaHash: row.senha_hash,
    nome: row.nome,
    ativo: row.ativo,
    criadoEm: row.criado_em,
  };
}

export async function criar(email: string, senhaHash: string, nome?: string): Promise<UsuarioRow> {
  const { rows } = await pool.query(
    "INSERT INTO usuarios (email, senha_hash, nome) VALUES ($1, $2, $3) RETURNING *",
    [email, senhaHash, nome ?? null],
  );
  return paraUsuario(rows[0]);
}

/** Case-insensitive (ver índice `usuarios_email_lower_idx`) — "Fulano@X.com" acha o cadastro salvo como "fulano@x.com". */
export async function buscarPorEmail(email: string): Promise<UsuarioRow | null> {
  const { rows } = await pool.query("SELECT * FROM usuarios WHERE lower(email) = lower($1)", [email]);
  return rows[0] ? paraUsuario(rows[0]) : null;
}

export async function buscarPorId(id: number): Promise<UsuarioRow | null> {
  const { rows } = await pool.query("SELECT * FROM usuarios WHERE id = $1", [id]);
  return rows[0] ? paraUsuario(rows[0]) : null;
}

/** Usado pelos agendadores (disparo automático, monitor de Telegram) pra iterar todo tenant que deve rodar. */
export async function listarAtivos(): Promise<Pick<UsuarioRow, "id">[]> {
  const { rows } = await pool.query("SELECT id FROM usuarios WHERE ativo = true");
  return rows;
}
