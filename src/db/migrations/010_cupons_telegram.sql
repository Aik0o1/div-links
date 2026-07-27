-- Cupons capturados do grupo de terceiros monitorado (MTProto/GramJS) — não são
-- "produtos" (sem título/preço/imagem próprios, um post pode trazer vários cupons
-- juntos), por isso ficam em tabelas separadas em vez de reaproveitar `produtos`.
CREATE TABLE cupons_capturados (
  id SERIAL PRIMARY KEY,
  texto TEXT NOT NULL,
  hash_conteudo TEXT UNIQUE NOT NULL,
  recebido_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cupons_disparos (
  id SERIAL PRIMARY KEY,
  cupom_id INTEGER NOT NULL REFERENCES cupons_capturados(id) ON DELETE CASCADE,
  canal_id INTEGER NOT NULL REFERENCES canais_destino(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | enviado | falhou
  enviado_em TIMESTAMPTZ
);
