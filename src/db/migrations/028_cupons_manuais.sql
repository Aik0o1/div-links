-- Cupom criado manualmente pelo painel (aba Cupons > "Criar cupom") em vez
-- de capturado de um grupo monitorado — guarda a plataforma que o usuário
-- escolheu explicitamente, já que sem link no texto detectarPlataformaCupom
-- (parsearCupons.ts) não tem como adivinhar (assume Mercado Livre por
-- padrão). NULL pra qualquer cupom capturado normalmente, que continua
-- usando a detecção por texto de sempre.
ALTER TABLE cupons_capturados ADD COLUMN plataforma_manual TEXT;
