-- Allow-list de grupos monitorados específicos que podem alimentar esse
-- canal — complementa categorias_permitidas/fontes_permitidas (013) com
-- controle por grupo individual, não só por nicho/origem genérica. Vazio
-- ou NULL = sem restrição (comportamento de hoje, nicho/origem mandam).
ALTER TABLE canais_destino ADD COLUMN IF NOT EXISTS grupos_monitorados_permitidos text[];
