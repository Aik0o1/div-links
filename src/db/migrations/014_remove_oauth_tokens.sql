-- OAuth do Mercado Livre nunca chegou a ser usado no fluxo ativo (título,
-- preço, imagem e link de afiliado vêm todos de scraping via Chrome, não da
-- API autenticada) — era resquício da abordagem original (API de Catálogo),
-- substituída pelo scraping da aba Ofertas por ter taxa de acerto muito
-- melhor. Decisão explícita do usuário: remover.
DROP TABLE IF EXISTS oauth_tokens;
