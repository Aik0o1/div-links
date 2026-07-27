CREATE TABLE produtos (
  id SERIAL PRIMARY KEY,
  fonte TEXT NOT NULL,
  url_original TEXT NOT NULL,
  url_afiliado TEXT,
  titulo TEXT,
  preco_original NUMERIC,
  preco_promocional NUMERIC,
  imagem_url TEXT,
  cupom TEXT,
  hash_conteudo TEXT UNIQUE,
  status TEXT DEFAULT 'capturado', -- capturado | aprovado | agendado | enviado | expirado
  criado_em TIMESTAMP DEFAULT now()
);

CREATE TABLE canais_destino (
  id SERIAL PRIMARY KEY,
  tipo TEXT CHECK (tipo IN ('whatsapp', 'telegram')),
  identificador_grupo TEXT NOT NULL,
  categorias_permitidas TEXT[],
  desconto_minimo NUMERIC DEFAULT 0,
  intervalo_minimo_minutos INTEGER DEFAULT 15,
  ativo BOOLEAN DEFAULT true
);

CREATE TABLE disparos (
  id SERIAL PRIMARY KEY,
  produto_id INTEGER REFERENCES produtos(id),
  canal_id INTEGER REFERENCES canais_destino(id),
  status TEXT DEFAULT 'pendente', -- pendente | enviado | falhou
  enviado_em TIMESTAMP
);
