-- Nicho especial: categoria_ids vazio significa "sem filtro de categoria" —
-- busca direto na aba geral de Ofertas, sem restringir por nicho. Serve pra
-- canais que postam qualquer tipo de produto.
INSERT INTO nichos (id, nome, categoria_ids) VALUES ('geral', 'Geral (todas as categorias)', '{}');
