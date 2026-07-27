CREATE TABLE oauth_tokens (
  plataforma TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expira_em TIMESTAMP NOT NULL,
  atualizado_em TIMESTAMP DEFAULT now()
);
