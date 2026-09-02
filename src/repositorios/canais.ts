import { pool } from "../db/pool.js";

export interface CanalRow {
  id: number;
  nome: string | null;
  tipo: "whatsapp" | "telegram";
  identificadorGrupo: string;
  categoriasPermitidas: string[] | null;
  /** Restringe por origem de captura ("mercado_livre" | "shopee" | "monitorados") — vazio/null aceita qualquer uma. */
  fontesPermitidas: string[] | null;
  /** Allow-list de grupos monitorados específicos (WhatsApp JID / Telegram chat id) — vazio/null sem restrição por grupo. Quando bate, ignora categoriasPermitidas pra esse produto (ver grupoMonitoradoStatus em dispararProduto.ts). */
  gruposMonitoradosPermitidos: string[] | null;
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
    fontesPermitidas: row.fontes_permitidas,
    gruposMonitoradosPermitidos: row.grupos_monitorados_permitidos,
    intervaloMinimoMinutos: row.intervalo_minimo_minutos,
    ativo: row.ativo,
  };
}

export async function listar(usuarioId: number): Promise<CanalRow[]> {
  const { rows } = await pool.query("SELECT * FROM canais_destino WHERE usuario_id = $1 ORDER BY id", [usuarioId]);
  return rows.map(paraCanal);
}

export async function buscarPorId(usuarioId: number, id: number): Promise<CanalRow | null> {
  const { rows } = await pool.query("SELECT * FROM canais_destino WHERE id = $1 AND usuario_id = $2", [id, usuarioId]);
  return rows[0] ? paraCanal(rows[0]) : null;
}

export async function criar(
  usuarioId: number,
  dados: {
    nome?: string | null;
    tipo: "whatsapp" | "telegram";
    identificadorGrupo: string;
    categoriasPermitidas?: string[] | null;
    fontesPermitidas?: string[] | null;
    gruposMonitoradosPermitidos?: string[] | null;
    intervaloMinimoMinutos?: number;
  },
): Promise<CanalRow> {
  const { rows } = await pool.query(
    `INSERT INTO canais_destino (usuario_id, nome, tipo, identificador_grupo, categorias_permitidas, fontes_permitidas, grupos_monitorados_permitidos, intervalo_minimo_minutos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      usuarioId,
      dados.nome ?? null,
      dados.tipo,
      dados.identificadorGrupo,
      dados.categoriasPermitidas ?? null,
      dados.fontesPermitidas ?? null,
      dados.gruposMonitoradosPermitidos ?? null,
      dados.intervaloMinimoMinutos ?? 15,
    ],
  );
  return paraCanal(rows[0]);
}

export async function atualizar(
  usuarioId: number,
  id: number,
  dados: Partial<{
    nome: string | null;
    identificadorGrupo: string;
    categoriasPermitidas: string[] | null;
    fontesPermitidas: string[] | null;
    gruposMonitoradosPermitidos: string[] | null;
    intervaloMinimoMinutos: number;
    ativo: boolean;
  }>,
): Promise<CanalRow | null> {
  // Só altera as colunas cujo campo veio de verdade no request (`!==
  // undefined`) — diferente de usar COALESCE, isso deixa `null`/`[]` ser um
  // valor válido e intencional (ex.: "sem restrição de nicho/origem"), sem
  // exigir que todo PUT sempre mande todos os campos juntos pra não apagar
  // os outros sem querer (o painel de config e o de dados básicos do canal
  // salvam separado, ver app.js).
  const sets: string[] = [];
  const valores: unknown[] = [id, usuarioId];

  function definir(coluna: string, valor: unknown) {
    valores.push(valor);
    sets.push(`${coluna} = $${valores.length}`);
  }

  if (dados.nome !== undefined) definir("nome", dados.nome);
  if (dados.identificadorGrupo !== undefined) definir("identificador_grupo", dados.identificadorGrupo);
  if (dados.categoriasPermitidas !== undefined) definir("categorias_permitidas", dados.categoriasPermitidas);
  if (dados.fontesPermitidas !== undefined) definir("fontes_permitidas", dados.fontesPermitidas);
  if (dados.gruposMonitoradosPermitidos !== undefined)
    definir("grupos_monitorados_permitidos", dados.gruposMonitoradosPermitidos);
  if (dados.intervaloMinimoMinutos !== undefined)
    definir("intervalo_minimo_minutos", dados.intervaloMinimoMinutos);
  if (dados.ativo !== undefined) definir("ativo", dados.ativo);

  if (sets.length === 0) return buscarPorId(usuarioId, id);

  const { rows } = await pool.query(
    `UPDATE canais_destino SET ${sets.join(", ")} WHERE id = $1 AND usuario_id = $2 RETURNING *`,
    valores,
  );
  return rows[0] ? paraCanal(rows[0]) : null;
}

export async function remover(usuarioId: number, id: number): Promise<void> {
  await pool.query("DELETE FROM canais_destino WHERE id = $1 AND usuario_id = $2", [id, usuarioId]);
}
