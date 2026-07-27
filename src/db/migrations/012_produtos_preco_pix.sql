-- Marca quando o preço anunciado no post do grupo monitorado é condicionado a
-- pagamento no Pix (comum em canais de cupom: "Por: R$82 pix"). Precisa ir
-- na legenda enviada pro canal do usuário, senão o preço mostrado passa a
-- impressão errada de valer em qualquer forma de pagamento.
ALTER TABLE produtos ADD COLUMN preco_no_pix BOOLEAN NOT NULL DEFAULT false;
