import { pool } from "../db/pool.js";

export interface UsuarioRow {
  id: number;
  email: string;
  /** Null pra conta que só existe via login com Google (nunca definiu senha própria). */
  senhaHash: string | null;
  nome: string | null;
  ativo: boolean;
  criadoEm: string;
  /** Id estável da conta Google vinculada ("sub") — null se nunca logou com Google. */
  googleId: string | null;
}

function paraUsuario(row: any): UsuarioRow {
  return {
    id: row.id,
    email: row.email,
    senhaHash: row.senha_hash,
    nome: row.nome,
    ativo: row.ativo,
    criadoEm: row.criado_em,
    googleId: row.google_id,
  };
}

export async function criar(email: string, senhaHash: string, nome?: string): Promise<UsuarioRow> {
  const { rows } = await pool.query(
    "INSERT INTO usuarios (email, senha_hash, nome) VALUES ($1, $2, $3) RETURNING *",
    [email, senhaHash, nome ?? null],
  );
  return paraUsuario(rows[0]);
}

/** Conta criada via primeiro login com Google — sem senha nenhuma (login por senha fica indisponível até o usuário definir uma, se algum dia isso existir). */
export async function criarComGoogle(email: string, googleId: string, nome?: string | null): Promise<UsuarioRow> {
  const { rows } = await pool.query(
    "INSERT INTO usuarios (email, senha_hash, nome, google_id) VALUES ($1, NULL, $2, $3) RETURNING *",
    [email, nome ?? null, googleId],
  );
  return paraUsuario(rows[0]);
}

/** Vincula uma conta Google a uma conta já existente (mesmo email, cadastrada por senha antes) — permite logar com Google ou com senha dali em diante. */
export async function vincularGoogleId(usuarioId: number, googleId: string): Promise<void> {
  await pool.query("UPDATE usuarios SET google_id = $2 WHERE id = $1", [usuarioId, googleId]);
}

/** Case-insensitive (ver índice `usuarios_email_lower_idx`) — "Fulano@X.com" acha o cadastro salvo como "fulano@x.com". */
export async function buscarPorEmail(email: string): Promise<UsuarioRow | null> {
  const { rows } = await pool.query("SELECT * FROM usuarios WHERE lower(email) = lower($1)", [email]);
  return rows[0] ? paraUsuario(rows[0]) : null;
}

export async function buscarPorGoogleId(googleId: string): Promise<UsuarioRow | null> {
  const { rows } = await pool.query("SELECT * FROM usuarios WHERE google_id = $1", [googleId]);
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
