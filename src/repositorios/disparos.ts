import { pool } from "../db/pool.js";

export async function registrar(
  produtoId: number,
  canalId: number,
  status: "enviado" | "falhou",
): Promise<void> {
  await pool.query(
    `INSERT INTO disparos (produto_id, canal_id, status, enviado_em)
     VALUES ($1, $2, $3, CASE WHEN $3 = 'enviado' THEN now() ELSE NULL END)`,
    [produtoId, canalId, status],
  );
}

/**
 * Último envio bem-sucedido pro canal, considerando `disparos` (produtos) E
 * `cupons_disparos` (cupons repassados) juntos. Necessário porque os dois
 * fluxos rodam de forma independente (um checa só `disparos`, o outro só
 * `cupons_disparos`) — sem essa checagem combinada, um cupom e um produto
 * podiam sair pro mesmo canal com poucos segundos de diferença, cada fluxo
 * achando (erradamente) que o intervalo mínimo tinha passado. Bug real
 * encontrado: duas mensagens pro mesmo canal do WhatsApp com 33s de
 * diferença, intervalo configurado de 8 minutos — risco de o número ser
 * marcado como spam.
 */
export async function ultimoEnvioGeralPorCanal(canalId: number): Promise<Date | null> {
  const { rows } = await pool.query(
    `SELECT MAX(enviado_em) AS ultimo FROM (
       SELECT enviado_em FROM disparos WHERE canal_id = $1 AND status = 'enviado'
       UNION ALL
       SELECT enviado_em FROM cupons_disparos WHERE canal_id = $1 AND status = 'enviado'
     ) t`,
    [canalId],
  );
  return rows[0]?.ultimo ?? null;
}

export async function contarFalhas(produtoId: number): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*) AS total FROM disparos WHERE produto_id = $1 AND status = 'falhou'`,
    [produtoId],
  );
  return Number(rows[0].total);
}

/** Total de disparos "hoje" (fuso America/Sao_Paulo) por status, pro card do Dashboard. */
export async function contarHoje(status: "enviado" | "falhou"): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count(*) AS total FROM disparos
     WHERE status = $1 AND criado_em AT TIME ZONE 'America/Sao_Paulo' >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')`,
    [status],
  );
  return Number(rows[0].total);
}

export interface DisparosPorHora {
  hora: number;
  enviados: number;
  falhas: number;
}

/** Disparos de hoje agrupados por hora (0-23, fuso America/Sao_Paulo) — preenche as 24 posições, mesmo sem disparo. */
export async function porHoraHoje(): Promise<DisparosPorHora[]> {
  const { rows } = await pool.query(
    `SELECT
       extract(hour FROM criado_em AT TIME ZONE 'America/Sao_Paulo')::int AS hora,
       count(*) FILTER (WHERE status = 'enviado') AS enviados,
       count(*) FILTER (WHERE status = 'falhou') AS falhas
     FROM disparos
     WHERE criado_em AT TIME ZONE 'America/Sao_Paulo' >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')
     GROUP BY hora`,
  );

  const porHora = new Map(rows.map((r) => [Number(r.hora), { enviados: Number(r.enviados), falhas: Number(r.falhas) }]));
  return Array.from({ length: 24 }, (_, hora) => ({
    hora,
    enviados: porHora.get(hora)?.enviados ?? 0,
    falhas: porHora.get(hora)?.falhas ?? 0,
  }));
}
