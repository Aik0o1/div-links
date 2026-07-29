-- enviado_em só é gravado em sucesso (ver registrar() em repositorios/disparos.ts),
-- então falha nunca tem timestamp — impede métrica de "falhas hoje" ou gráfico
-- por hora do Dashboard. criado_em é sempre preenchido, sucesso ou falha.
ALTER TABLE disparos ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT now();
UPDATE disparos SET criado_em = enviado_em WHERE enviado_em IS NOT NULL;
-- Falhas pré-existentes (sem enviado_em) não têm timestamp real recuperável —
-- ADD COLUMN...DEFAULT now() carimbaria todas com o horário da migration,
-- inflando "falhas hoje" com histórico antigo. Joga pro passado (fora de
-- qualquer janela "hoje" possível) em vez de fingir que aconteceram agora.
UPDATE disparos SET criado_em = '2000-01-01'::timestamptz WHERE enviado_em IS NULL AND status = 'falhou';
