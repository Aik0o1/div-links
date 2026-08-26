-- Cobrança via Mercado Pago (Checkout Pro / Assinaturas recorrentes) — ver
-- plano em /home/victor/.claude/plans/nifty-squishing-widget.md.
--
-- Uma assinatura por conta (usuario_id UNIQUE) — trocar de plano cancela a
-- atual no Mercado Pago e cria uma nova, não faz upsert de valores dentro da
-- mesma preapproval. `status`:
--   trial     — 7 dias grátis no plano Básico, criado automaticamente no
--               signup (trial_expira_em preenchido, resto null).
--   pendente  — checkout criado (mp_preapproval_id preenchido), aguardando o
--               cliente autorizar no Mercado Pago.
--   ativa     — autorizada e em dia.
--   atrasada  — cobrança recorrente falhou (cartão recusado etc.).
--   cancelada — cancelada (pelo tenant ou pelo Mercado Pago).
--   isenta    — conta isenta de cobrança (ex.: a conta do dono do produto),
--               nunca passa pelo Mercado Pago.
CREATE TABLE assinaturas (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id),
  plano TEXT NOT NULL CHECK (plano IN ('basico', 'pro', 'plus')),
  status TEXT NOT NULL CHECK (status IN ('trial', 'pendente', 'ativa', 'atrasada', 'cancelada', 'isenta')),
  mp_preapproval_id TEXT,
  trial_expira_em TIMESTAMPTZ,
  proxima_cobranca_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX assinaturas_mp_preapproval_id_idx ON assinaturas (mp_preapproval_id);

-- Histórico de cobranças recorrentes recebidas (via webhook ou polling) —
-- pra exibir extrato/fatura pro tenant e auditoria. `mp_payment_id` UNIQUE
-- evita duplicar o mesmo pagamento se o webhook chegar mais de uma vez
-- (Mercado Pago não garante entrega única).
CREATE TABLE pagamentos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  mp_payment_id TEXT UNIQUE,
  valor NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pagamentos_usuario_id_idx ON pagamentos (usuario_id);
