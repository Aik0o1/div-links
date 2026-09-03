import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, mensagemAmigavel } from "@/lib/api";

export interface ItemPreRequisito {
  id: string;
  label: string;
  ok: boolean;
  obrigatorio: boolean;
  dica: string;
  aba: string;
}

export interface JanelaDisparoAutomatico {
  /** "HH:MM", fuso America/Sao_Paulo. */
  inicio: string;
  fim: string;
}

/**
 * Estado do disparo automático + pré-requisitos obrigatórios, compartilhado
 * entre a TopBar (controle global) e o Dashboard (card de status detalhado)
 * — uma única instância criada em App.tsx e passada como prop pra ambos, pra
 * nunca ficar dessincronizado entre os dois lugares que mostram/controlam a
 * mesma coisa.
 */
export function useDisparoAutomatico(habilitado: boolean) {
  const [ativo, setAtivo] = useState(false);
  const [janela, setJanela] = useState<JanelaDisparoAutomatico | null>(null);
  const [itensPreReq, setItensPreReq] = useState<ItemPreRequisito[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoAcao, setCarregandoAcao] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        api<{ ativo: boolean; janela: JanelaDisparoAutomatico | null }>("/disparo-automatico"),
        api<{ itens: ItemPreRequisito[] }>("/dashboard/pre-requisitos"),
      ]);
      setAtivo(d.ativo);
      setJanela(d.janela);
      setItensPreReq(p.itens);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // Só busca depois que a sessão/assinatura estiverem resolvidas — evita
    // chamar uma rota autenticada antes de existir sessão (login/cadastro)
    // ou enquanto a tela de bloqueio de assinatura está sendo exibida.
    if (habilitado) recarregar();
  }, [habilitado, recarregar]);

  const pendentesObrigatorios = itensPreReq?.filter((i) => i.obrigatorio && !i.ok) ?? [];

  async function iniciar() {
    setCarregandoAcao(true);
    try {
      await api("/disparo-automatico/iniciar", { method: "POST" });
      toast.success("Disparo automático iniciado.");
      await recarregar();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
      await recarregar();
    } finally {
      setCarregandoAcao(false);
    }
  }

  async function pausar() {
    setCarregandoAcao(true);
    try {
      await api("/disparo-automatico/pausar", { method: "POST" });
      toast.success("Disparo automático pausado.");
      await recarregar();
    } finally {
      setCarregandoAcao(false);
    }
  }

  /** `null` remove a restrição — passa a disparar a qualquer hora de novo. */
  async function salvarJanela(novaJanela: JanelaDisparoAutomatico | null) {
    try {
      await api("/disparo-automatico/janela", {
        method: "PUT",
        body: JSON.stringify(novaJanela ?? { inicio: null, fim: null }),
      });
      setJanela(novaJanela);
      toast.success(novaJanela ? "Horário do disparo automático salvo." : "Restrição de horário removida.");
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }

  return {
    ativo,
    janela,
    itensPreReq,
    pendentesObrigatorios,
    carregando,
    carregandoAcao,
    iniciar,
    pausar,
    salvarJanela,
    recarregar,
  };
}

export type DisparoAutomatico = ReturnType<typeof useDisparoAutomatico>;
