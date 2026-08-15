-- Fundação de auth pro SaaS multi-tenant (ver PROJECT_STATUS.md / plano de
-- multi-tenant) — só cria as tabelas, não mexe em nada existente ainda.
-- Nenhuma tabela hoje tem usuario_id (isso vem na migration seguinte,
-- 022_usuario_id_expand.sql, depois que essa aqui já tiver rodado).

CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive: "Fulano@Gmail.com" e "fulano@gmail.com" são o mesmo
-- cadastro. Índice funcional em vez de normalizar na escrita, pra não
-- depender de toda call site lembrar de fazer lower() antes de inserir.
CREATE UNIQUE INDEX usuarios_email_lower_idx ON usuarios (lower(email));

CREATE TABLE sessoes (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  -- Nunca o token bruto — só o hash. Um dump do Postgres vazando não dá pra
  -- sequestrar sessão de ninguém direto (mesmo padrão do Django/GitHub).
  token_hash TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL,
  ultimo_uso_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX sessoes_usuario_id_idx ON sessoes (usuario_id);
CREATE INDEX sessoes_expira_em_idx ON sessoes (expira_em);
