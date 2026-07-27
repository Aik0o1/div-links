ALTER TABLE disparos DROP CONSTRAINT disparos_produto_id_fkey;
ALTER TABLE disparos ADD CONSTRAINT disparos_produto_id_fkey
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE;
