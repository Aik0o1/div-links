-- Remove a chamada gerada por IA local (Ollama) do sistema — funcionalidade
-- removida, chamada agora é só manual (ver PROJECT_STATUS.md seção 2.3).
DELETE FROM configuracoes WHERE chave = 'chamada_ia_ativa';
