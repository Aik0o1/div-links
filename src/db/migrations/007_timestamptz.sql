-- Colunas TIMESTAMP (sem fuso) são gravadas certas (Postgres roda em UTC), mas o
-- driver as lê de volta assumindo o fuso LOCAL do processo Node (que pode ser
-- diferente), gerando contas de intervalo erradas. TIMESTAMPTZ resolve isso de vez.

ALTER TABLE produtos ALTER COLUMN criado_em TYPE TIMESTAMPTZ USING criado_em AT TIME ZONE 'UTC';
ALTER TABLE produtos ALTER COLUMN criado_em SET DEFAULT now();

ALTER TABLE disparos ALTER COLUMN enviado_em TYPE TIMESTAMPTZ USING enviado_em AT TIME ZONE 'UTC';

ALTER TABLE oauth_tokens ALTER COLUMN expira_em TYPE TIMESTAMPTZ USING expira_em AT TIME ZONE 'UTC';
ALTER TABLE oauth_tokens ALTER COLUMN atualizado_em TYPE TIMESTAMPTZ USING atualizado_em AT TIME ZONE 'UTC';
ALTER TABLE oauth_tokens ALTER COLUMN atualizado_em SET DEFAULT now();

ALTER TABLE schema_migrations ALTER COLUMN aplicada_em TYPE TIMESTAMPTZ USING aplicada_em AT TIME ZONE 'UTC';
ALTER TABLE schema_migrations ALTER COLUMN aplicada_em SET DEFAULT now();
