import { useCallback, useEffect, useState } from "react";
import { api, EVENTO_ASSINATURA_BLOQUEADA } from "./api";

export type PlanoId = "basico" | "pro" | "plus";
export type StatusAssinaturaId = "trial" | "pendente" | "ativa" | "atrasada" | "cancelada" | "isenta";

export interface StatusAssinatura {
  plano: PlanoId | null;
  status: StatusAssinaturaId | null;
  trialExpiraEm: string | null;
  proximaCobrancaEm: string | null;
  acessoLiberado: boolean;
}

export interface PlanoInfo {
  id: PlanoId;
  nome: string;
  precoCentavos: number;
  limiteCanais: number;
  limiteGruposMonitorados: number;
}

/**
 * Status da assinatura do tenant — `GET /api/assinatura` nunca fica atrás do
 * bloqueio de assinatura (ver app.ts no backend), então sempre responde
 * mesmo pra conta bloqueada; é o campo `acessoLiberado` que diz se o resto
 * do painel deve aparecer (ver App.tsx). Escuta o mesmo evento global que
 * qualquer OUTRA chamada de API dispara ao voltar 402 (ex.: trial venceu com
 * o painel já aberto), pra derrubar a tela na hora sem esperar um refetch.
 */
export function useAssinatura(usuarioLogado: boolean) {
  const [assinatura, setAssinatura] = useState<StatusAssinatura | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      const dados = await api<StatusAssinatura>("/assinatura");
      setAssinatura(dados);
    } catch {
      // Erro de rede genuíno (não 402 — esse já dispara o evento abaixo) — não tem o que fazer aqui além de deixar carregando=false.
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (usuarioLogado) {
      recarregar();
    } else {
      setAssinatura(null);
      setCarregando(false);
    }
  }, [usuarioLogado, recarregar]);

  useEffect(() => {
    const aoBloquear = () => setAssinatura((atual) => (atual ? { ...atual, acessoLiberado: false } : atual));
    window.addEventListener(EVENTO_ASSINATURA_BLOQUEADA, aoBloquear);
    return () => window.removeEventListener(EVENTO_ASSINATURA_BLOQUEADA, aoBloquear);
  }, []);

  return { assinatura, carregando, recarregar };
}
