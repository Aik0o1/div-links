-- Fase 5 do plano multi-tenant ("contract") — só roda depois de confirmar
-- que TODO INSERT/UPDATE do código em produção já passa usuario_id (Fase 4
-- mergeada e rodando) e que não sobra nenhuma linha com usuario_id NULL nas
-- 7 tabelas (checado manualmente antes de aplicar esta migration).
--
-- Faz duas coisas:
-- 1. usuario_id vira NOT NULL nas 7 tabelas (era nullable desde a 022, pra
--    permitir o expand/backfill sem downtime).
-- 2. Troca as constraints antigas (single-tenant) pelas compostas por
--    usuario_id criadas de forma aditiva na 023:
--    - produtos/cupons_capturados: cai o UNIQUE(hash_conteudo) sozinho —
--      dois tenants podem capturar o mesmo produto real (mesmo hash), só não
--      o mesmo tenant duas vezes (produtos_usuario_hash_idx/
--      cupons_capturados_usuario_hash_idx da 023 já garantem isso).
--    - nichos: PK (id) vira PK (usuario_id, id) — cada tenant tem os
--      próprios ids de nicho (ex.: "geral"), sem colidir com o de outro.
--    - configuracoes: PK (chave) vira PK (usuario_id, chave) — mesma ideia,
--      cada tenant tem sua própria config key-value.
-- Nenhuma FK aponta pra nichos(id) nem configuracoes(chave) (confirmado via
-- pg_constraint antes de escrever esta migration), então trocar a PK delas
-- é seguro.

ALTER TABLE produtos ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE canais_destino ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE nichos ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE cupons_capturados ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE configuracoes ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE disparos ALTER COLUMN usuario_id SET NOT NULL;
ALTER TABLE cupons_disparos ALTER COLUMN usuario_id SET NOT NULL;

ALTER TABLE produtos DROP CONSTRAINT produtos_hash_conteudo_key;
ALTER TABLE cupons_capturados DROP CONSTRAINT cupons_capturados_hash_conteudo_key;

ALTER TABLE nichos DROP CONSTRAINT nichos_pkey;
ALTER TABLE nichos ADD CONSTRAINT nichos_pkey PRIMARY KEY USING INDEX nichos_usuario_id_idx;

ALTER TABLE configuracoes DROP CONSTRAINT configuracoes_pkey;
ALTER TABLE configuracoes ADD CONSTRAINT configuracoes_pkey PRIMARY KEY USING INDEX configuracoes_usuario_chave_idx;
