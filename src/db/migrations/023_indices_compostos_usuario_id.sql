-- Passo intermediário entre "expand" (022) e o corte final (futura
-- migration de contract, ainda não escrita) — puramente ADITIVO: cria
-- índices únicos/normais novos incluindo usuario_id, SEM tocar nas
-- constraints antigas (produtos_hash_conteudo_key, nichos_pkey,
-- configuracoes_pkey, etc. continuam existindo do jeito que estão).
--
-- Motivo de existir separado do contract final: o código novo (Fase 4 do
-- plano multi-tenant) precisa de `ON CONFLICT (usuario_id, ...)` pra
-- funcionar — isso exige que a constraint/index já exista. Mas dropar a
-- constraint ANTIGA só é seguro depois que o código novo estiver ativado de
-- vez (o processo antigo, ainda rodando em produção sem usuario_id, quebra
-- na hora se a constraint que ele espera sumir no meio do caminho). Rodando
-- só a parte aditiva agora, o código novo pode ser escrito/testado sem
-- esperar por um corte coordenado arriscado.

CREATE UNIQUE INDEX produtos_usuario_hash_idx ON produtos (usuario_id, hash_conteudo);
CREATE UNIQUE INDEX cupons_capturados_usuario_hash_idx ON cupons_capturados (usuario_id, hash_conteudo);
CREATE UNIQUE INDEX nichos_usuario_id_idx ON nichos (usuario_id, id);
CREATE UNIQUE INDEX configuracoes_usuario_chave_idx ON configuracoes (usuario_id, chave);

CREATE INDEX produtos_usuario_id_idx ON produtos (usuario_id);
CREATE INDEX canais_destino_usuario_id_idx ON canais_destino (usuario_id);
CREATE INDEX disparos_usuario_id_idx ON disparos (usuario_id);
CREATE INDEX cupons_capturados_usuario_id_idx ON cupons_capturados (usuario_id);
CREATE INDEX cupons_disparos_usuario_id_idx ON cupons_disparos (usuario_id);
