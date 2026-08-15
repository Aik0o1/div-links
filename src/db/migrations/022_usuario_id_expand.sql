-- Fase 2 do plano multi-tenant: "expand" — adiciona usuario_id NULLABLE em
-- toda tabela que precisa virar por-tenant. Puramente aditivo, zero
-- downtime: código existente continua rodando sem saber que a coluna
-- existe (nenhuma constraint NOT NULL/UNIQUE muda ainda).
--
-- Próximos passos (fora desta migration, ver plano salvo):
--   1. Rodar src/db/backfillContaInicial.ts (cria a conta do Victor, dono
--      de todo dado que já existe hoje).
--   2. Migration 023_usuario_id_contract.sql — só depois do backfill
--      confirmado (usuario_id IS NULL = 0 em tudo) — torna NOT NULL e troca
--      as UNIQUE/PK que precisam incluir usuario_id.

ALTER TABLE produtos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE canais_destino ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE nichos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE cupons_capturados ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE configuracoes ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id);

-- disparos e cupons_disparos ganham usuario_id próprio (redundante, não só
-- via JOIN com produtos/canais_destino) — defesa em profundidade e evita
-- JOIN em hot-paths (ultimoEnvioGeralPorCanal, contadores do dashboard).
ALTER TABLE disparos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE cupons_disparos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id);
