import { pool } from "../db/pool.js";

export interface PagamentoRow {
  id: number;
  usuarioId: number;
  mpPaymentId: string;
  valor: number;
  status: string;
  criadoEm: string;
}

function paraPagamento(row: any): PagamentoRow {
  return {
    id: row.id,
    usuarioId: row.usuario_id,
    mpPaymentId: row.mp_payment_id,
    valor: Number(row.valor),
    status: row.status,
    criadoEm: row.criado_em,
  };
}

/**
 * `ON CONFLICT (mp_payment_id) DO NOTHING` — o Mercado Pago não garante
 * entrega única de webhook, e o polling ativo (ver serviços/assinatura.ts)
 * pode checar o mesmo pagamento mais de uma vez; sem isso duplicaria linha
 * no histórico a cada nova notificação do mesmo pagamento.
 */
export async function registrarSeNovo(
  usuarioId: number,
  mpPaymentId: string,
  valor: number,
  status: string,
): Promise<PagamentoRow | null> {
  const { rows } = await pool.query(
    `INSERT INTO pagamentos (usuario_id, mp_payment_id, valor, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (mp_payment_id) DO NOTHING
     RETURNING *`,
    [usuarioId, mpPaymentId, valor, status],
  );
  return rows[0] ? paraPagamento(rows[0]) : null;
}

export async function listarPorUsuarioId(usuarioId: number, limite = 50): Promise<PagamentoRow[]> {
  const { rows } = await pool.query(
    "SELECT * FROM pagamentos WHERE usuario_id = $1 ORDER BY criado_em DESC LIMIT $2",
    [usuarioId, limite],
  );
  return rows.map(paraPagamento);
}
