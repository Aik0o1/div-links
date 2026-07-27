ALTER TABLE produtos ADD COLUMN nicho TEXT;

CREATE TABLE nichos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  termos_busca TEXT[] NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO nichos (id, nome, termos_busca) VALUES
  ('tecnologia', 'Tecnologia', ARRAY['celular','fone bluetooth','notebook','smartwatch','carregador','caixa de som']),
  ('beleza', 'Beleza', ARRAY['maquiagem','perfume','skincare','batom','shampoo','secador de cabelo']),
  ('moda', 'Moda', ARRAY['roupa feminina','roupa masculina','tenis','bolsa','relogio','oculos de sol']),
  ('casa', 'Casa', ARRAY['panela','eletrodomestico','decoracao','cama mesa banho','organizador','aspirador de po']),
  ('gamer', 'Gamer', ARRAY['cadeira gamer','mouse gamer','teclado mecanico','headset gamer','monitor gamer']);

CREATE TABLE configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

INSERT INTO configuracoes (chave, valor) VALUES ('desconto_minimo', '0');

INSERT INTO canais_destino (tipo, identificador_grupo, categorias_permitidas, desconto_minimo, ativo)
VALUES ('telegram', '-5285078548', NULL, 0, true);
