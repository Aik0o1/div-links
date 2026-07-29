-- Permite restringir um canal também por origem de captura (Mercado Livre,
-- Shopee, grupos monitorados), além do nicho já existente — configurado
-- junto na aba Canais. NULL/vazio = aceita qualquer origem.
ALTER TABLE canais_destino ADD COLUMN fontes_permitidas TEXT[];
