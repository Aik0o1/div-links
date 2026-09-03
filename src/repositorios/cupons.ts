import { createHash } from "node:crypto";
import { pool } from "../db/pool.js";

export interface CupomRow {
  id: number;
  texto: string;
  recebidoEm: string;
  /** Id do grupo monitorado (WhatsApp JID ou Telegram chat id) que originou esse cupom — null se veio de antes dessa coluna existir. */
  grupoOrigemId: string | null;
  /** Plataforma escolhida explicitamente ao criar manualmente (ver inserirManual) — null pra cupom capturado normalmente, que usa detectarPlataformaCupom no texto (parsearCupons.ts). */
  plataformaManual: "shopee" | "mercado_livre" | null;
}

function paraCupom(row: any): CupomRow {
  return {
    id: row.id,
    texto: row.texto,
    recebidoEm: row.recebido_em,
    grupoOrigemId: row.grupo_origem_id,
    plataformaManual: row.plataforma_manual,
  };
}

export function hashTexto(texto: string): string {
  return createHash("sha1").update(texto.trim()).digest("hex");
}

/** Insere se o texto ainda não foi visto por esse tenant (dedup por hash); devolve null se já existia. */
export async function inserirSeNovo(
  usuarioId: number,
  texto: string,
  grupoOrigemId?: string,
): Promise<CupomRow | null> {
  const hash = hashTexto(texto);
  const { rows } = await pool.query(
    `INSERT INTO cupons_capturados (usuario_id, texto, hash_conteudo, grupo_origem_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (usuario_id, hash_conteudo) DO NOTHING
     RETURNING *`,
    [usuarioId, texto, hash, grupoOrigemId ?? null],
  );
  return rows[0] ? paraCupom(rows[0]) : null;
}

/** Cria um cupom direto pelo painel (sem grupo monitorado), com a plataforma escolhida explicitamente — mesma dedup por hash de `inserirSeNovo` (devolve null se texto idêntico já existia). */
export async function inserirManual(
  usuarioId: number,
  texto: string,
  plataforma: "shopee" | "mercado_livre",
): Promise<CupomRow | null> {
  const hash = hashTexto(texto);
  const { rows } = await pool.query(
    `INSERT INTO cupons_capturados (usuario_id, texto, hash_conteudo, plataforma_manual)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (usuario_id, hash_conteudo) DO NOTHING
     RETURNING *`,
    [usuarioId, texto, hash, plataforma],
  );
  return rows[0] ? paraCupom(rows[0]) : null;
}

/** Apaga todos os cupons desse tenant (cascata limpa cupons_disparos junto) — pro botão "Apagar tudo" da aba Cupons. */
export async function apagarTodos(usuarioId: number): Promise<number> {
  const { rowCount } = await pool.query("DELETE FROM cupons_capturados WHERE usuario_id = $1", [usuarioId]);
  return rowCount ?? 0;
}

export async function listarRecentes(usuarioId: number, limite = 50): Promise<CupomRow[]> {
  const { rows } = await pool.query(
    "SELECT * FROM cupons_capturados WHERE usuario_id = $1 ORDER BY recebido_em DESC LIMIT $2",
    [usuarioId, limite],
  );
  return rows.map(paraCupom);
}

export interface DisparoCupomRow {
  canalId: number;
  status: string;
  enviadoEm: string | null;
}

/** Disparos (tentados ou enviados) desse cupom, um por canal em que foi tentado — pra mostrar na aba Cupons pra onde cada um foi (ou tentou ir). */
export async function listarDisparosPorCupom(usuarioId: number, cupomId: number): Promise<DisparoCupomRow[]> {
  const { rows } = await pool.query(
    "SELECT canal_id, status, enviado_em FROM cupons_disparos WHERE cupom_id = $1 AND usuario_id = $2 ORDER BY id ASC",
    [cupomId, usuarioId],
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
export async function listarPendentesParaCanal(
  usuarioId: number,
  canalId: number,
  limite = 20,
): Promise<CupomRow[]> {
  const { rows } = await pool.query(
    `SELECT cc.* FROM cupons_capturados cc
     WHERE cc.usuario_id = $1
       AND cc.recebido_em > now() - ($4::text || ' hours')::interval
       AND NOT EXISTS (
         SELECT 1 FROM cupons_disparos cd
         WHERE cd.cupom_id = cc.id AND cd.canal_id = $2 AND cd.status = 'enviado'
       )
     ORDER BY cc.recebido_em ASC
     LIMIT $3`,
    [usuarioId, canalId, limite, JANELA_RETENTATIVA_HORAS],
  );
  return rows.map(paraCupom);
}

/**
 * Apaga cupons capturados há mais de `dias` (qualquer tenant) — cai em
 * cascata sobre `cupons_disparos` (ON DELETE CASCADE). Depois de
 * `JANELA_RETENTATIVA_HORAS`, um cupom parado nunca mais é reenviado
 * mesmo — não faz sentido guardar pra sempre só pra listar na aba Cupons
 * (ver agendadorLimpezaCupons.ts). Devolve quantos removeu, só pra log.
 */
export async function removerAntigos(dias: number): Promise<number> {
  const { rowCount } = await pool.query(
    "DELETE FROM cupons_capturados WHERE recebido_em < now() - ($1::text || ' days')::interval",
    [dias],
  );
  return rowCount ?? 0;
}

export async function registrarDisparo(
  usuarioId: number,
  cupomId: number,
  canalId: number,
  status: "enviado" | "falhou",
): Promise<void> {
  await pool.query(
    `INSERT INTO cupons_disparos (usuario_id, cupom_id, canal_id, status, enviado_em)
     VALUES ($1, $2, $3, $4, CASE WHEN $4 = 'enviado' THEN now() ELSE NULL END)`,
    [usuarioId, cupomId, canalId, status],
  );
}
