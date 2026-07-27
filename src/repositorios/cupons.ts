import { createHash } from "node:crypto";
import { pool } from "../db/pool.js";

export interface CupomRow {
  id: number;
  texto: string;
  recebidoEm: string;
}

function paraCupom(row: any): CupomRow {
  return { id: row.id, texto: row.texto, recebidoEm: row.recebido_em };
}

export function hashTexto(texto: string): string {
  return createHash("sha1").update(texto.trim()).digest("hex");
}

/** Insere se o texto ainda não foi visto (dedup por hash); devolve null se já existia. */
export async function inserirSeNovo(texto: string): Promise<CupomRow | null> {
  const hash = hashTexto(texto);
  const { rows } = await pool.query(
    `INSERT INTO cupons_capturados (texto, hash_conteudo)
     VALUES ($1, $2)
     ON CONFLICT (hash_conteudo) DO NOTHING
     RETURNING *`,
    [texto, hash],
  );
  return rows[0] ? paraCupom(rows[0]) : null;
}

export async function listarRecentes(limite = 50): Promise<CupomRow[]> {
  const { rows } = await pool.query(
    "SELECT * FROM cupons_capturados ORDER BY recebido_em DESC LIMIT $1",
    [limite],
  );
  return rows.map(paraCupom);
}

export async function registrarDisparo(
  cupomId: number,
  canalId: number,
  status: "enviado" | "falhou",
): Promise<void> {
  await pool.query(
    `INSERT INTO cupons_disparos (cupom_id, canal_id, status, enviado_em)
     VALUES ($1, $2, $3, CASE WHEN $3 = 'enviado' THEN now() ELSE NULL END)`,
    [cupomId, canalId, status],
  );
}
