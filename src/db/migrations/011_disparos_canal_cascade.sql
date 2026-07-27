-- Mesmo ajuste que a migration 004 já fez pra produto_id: sem isso, um canal
-- com qualquer histórico em `disparos` não pode ser removido (viola FK).
ALTER TABLE disparos DROP CONSTRAINT disparos_canal_id_fkey;
ALTER TABLE disparos ADD CONSTRAINT disparos_canal_id_fkey
  FOREIGN KEY (canal_id) REFERENCES canais_destino(id) ON DELETE CASCADE;
