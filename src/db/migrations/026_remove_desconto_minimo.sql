-- Remove o "desconto mínimo" (filtro por canal e configuração geral de
-- captura) do sistema — pedido explícito do usuário. Nem canaisElegiveis
-- nem proximoProdutoElegivel (dispararProduto.ts) checam mais desconto
-- nenhum, e a captura em massa do Mercado Livre (capturarProdutos.ts) não
-- filtra mais por desconto.
ALTER TABLE canais_destino DROP COLUMN IF EXISTS desconto_minimo;

-- Config chave-valor genérica (não é coluna própria) — remove a linha
-- órfã de quem já tinha configurado um valor, pra não deixar lixo.
DELETE FROM configuracoes WHERE chave = 'desconto_minimo';
