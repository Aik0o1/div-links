import { createHash } from "node:crypto";
import { pool } from "../db/pool.js";

export interface CupomRow {
  id: number;
  texto: string;
  recebidoEm: string;
  /** Id do grupo monitorado (WhatsApp JID ou Telegram chat id) que originou esse cupom — null se veio de antes dessa coluna existir. */
  grupoOrigemId: string | null;
}

function paraCupom(row: any): CupomRow {
  return { id: row.id, texto: row.texto, recebidoEm: row.recebido_em, grupoOrigemId: row.grupo_origem_id };
}

export function hashTexto(texto: string): string {
  return createHash("sha1").update(texto.trim()).digest("hex");
}

/** Insere se o texto ainda não foi visto (dedup por hash); devolve null se já existia. */
export async function inserirSeNovo(texto: string, grupoOrigemId?: string): Promise<CupomRow | null> {
  const hash = hashTexto(texto);
  const { rows } = await pool.query(
    `INSERT INTO cupons_capturados (texto, hash_conteudo, grupo_origem_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (hash_conteudo) DO NOTHING
     RETURNING *`,
    [texto, hash, grupoOrigemId ?? null],
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

export interface DisparoCupomRow {
  canalId: number;
  status: string;
  enviadoEm: string | null;
}

/** Disparos (tentados ou enviados) desse cupom, um por canal em que foi tentado — pra mostrar na aba Cupons pra onde cada um foi (ou tentou ir). */
export async function listarDisparosPorCupom(cupomId: number): Promise<DisparoCupomRow[]> {
  const { rows } = await pool.query(
    "SELECT canal_id, status, enviado_em FROM cupons_disparos WHERE cupom_id = $1 ORDER BY id ASC",
    [cupomId],
  );
  return rows.map((r) => ({ canalId: r.canal_id, status: r.status, enviadoEm: r.enviado_em }));
}

// Cupom capturado há mais tempo que isso não entra mais na fila de
// retentativa — evita ressuscitar cupom velho/de teste que nunca tinha sido
// mandado pra um canal específico (ex.: porque o canal foi criado/ativado
// depois). Bug real: um cupom de teste de 2 dias atrás ("🚨 TESTE 👉 20%
// OFF", nunca enviado pro canal X) foi disparado de verdade assim que esse
// canal ficou elegível, furando na frente de um cupom reoal e recente.
const JANELA_RETENTATIVA_HORAS = 3;

/**
 * Cupons ainda não enviados com sucesso pra esse canal específico, capturados
 * há no máximo `JANELA_RETENTATIVA_HORAS` (mais antigo primeiro dentro dessa
 * janela) — inclui os que nunca foram tentados e os que já falharam antes.
 * Usado pelo agendador de disparo pra repassar cupom com prioridade máxima,
 * com retentativa — antes, um cupom bloqueado pelo intervalo mínimo do canal
 * no momento em que chegou se perdia pra sempre, sem nenhuma tentativa nova
 * depois.
 */
export async function listarPendentesParaCanal(canalId: number, limite = 20): Promise<CupomRow[]> {
  const { rows } = await pool.query(
    `SELECT cc.* FROM cupons_capturados cc
     WHERE cc.recebido_em > now() - ($3::text || ' hours')::interval
       AND NOT EXISTS (
         SELECT 1 FROM cupons_disparos cd
         WHERE cd.cupom_id = cc.id AND cd.canal_id = $1 AND cd.status = 'enviado'
       )
     ORDER BY cc.recebido_em ASC
     LIMIT $2`,
    [canalId, limite, JANELA_RETENTATIVA_HORAS],
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
