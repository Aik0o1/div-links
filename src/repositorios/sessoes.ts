import { pool } from "../db/pool.js";

export interface SessaoRow {
  id: number;
  usuarioId: number;
  tokenHash: string;
  expiraEm: string;
}

const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
// Só renova `expira_em` se faltar menos que isso — evita um UPDATE a cada
// request autenticada (o "sliding window" real fica só perto de expirar).
const JANELA_RENOVACAO_MS = 15 * 24 * 60 * 60 * 1000;

export async function criar(
  usuarioId: number,
  tokenHash: string,
  contexto?: { userAgent?: string; ip?: string },
): Promise<SessaoRow> {
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  const { rows } = await pool.query(
    `INSERT INTO sessoes (usuario_id, token_hash, expira_em, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, usuario_id, token_hash, expira_em`,
    [usuarioId, tokenHash, expiraEm, contexto?.userAgent ?? null, contexto?.ip ?? null],
  );
  return paraSessao(rows[0]);
}

function paraSessao(row: any): SessaoRow {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    tokenHash: row.token_hash,
    expiraEm: row.expira_em,
  };
}

/** Só devolve sessão ainda válida (`expira_em` no futuro) — sessão expirada é tratada como inexistente. */
export async function buscarValidaPorHash(tokenHash: string): Promise<SessaoRow | null> {
  const { rows } = await pool.query(
    "SELECT id, usuario_id, token_hash, expira_em FROM sessoes WHERE token_hash = $1 AND expira_em > now()",
    [tokenHash],
  );
  return rows[0] ? paraSessao(rows[0]) : null;
}

/**
 * Fire-and-forget a cada request autenticada (ver middleware de auth) —
 * atualiza `ultimo_uso_em` sempre, mas só empurra `expira_em` pra frente
 * quando já está chegando perto de vencer (ver JANELA_RENOVACAO_MS), pra
 * não virar um UPDATE por request.
 */
export async function tocarUltimoUso(id: number): Promise<void> {
  await pool.query(
    `UPDATE sessoes
     SET ultimo_uso_em = now(),
         expira_em = CASE WHEN expira_em - now() < $2::interval THEN now() + $3::interval ELSE expira_em END
     WHERE id = $1`,
    [id, `${JANELA_RENOVACAO_MS} milliseconds`, `${DURACAO_SESSAO_MS} milliseconds`],
  );
}

export async function removerPorHash(tokenHash: string): Promise<void> {
  await pool.query("DELETE FROM sessoes WHERE token_hash = $1", [tokenHash]);
}
