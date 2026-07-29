-- Rastreia qual grupo monitorado (WhatsApp JID ou Telegram chat id) originou
-- um produto capturado via grupo monitorado — usado pra permitir restringir
-- um canal de destino a grupos monitorados específicos (ver 017), em vez de
-- só nicho/origem genérica. NULL pra produto que não veio de grupo
-- monitorado (captura em massa ML/Shopee).
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS grupo_origem_id text;
