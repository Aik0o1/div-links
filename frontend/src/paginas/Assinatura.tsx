import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, RefreshCw, XCircle, Lock } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StatusAssinatura, PlanoInfo, PlanoId } from "@/lib/assinatura";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/TopBar";

const ROTULO_STATUS: Record<string, string> = {
  trial: "Período grátis",
  pendente: "Aguardando pagamento",
  ativa: "Ativa",
  atrasada: "Pagamento atrasado",
  cancelada: "Cancelada",
  isenta: "Isenta",
};

const VARIANTE_STATUS: Record<string, string> = {
  trial: "bg-warning-soft text-warning",
  pendente: "bg-warning-soft text-warning",
  ativa: "bg-success-soft text-success",
  atrasada: "bg-destructive-soft text-destructive",
  cancelada: "bg-destructive-soft text-destructive",
  isenta: "bg-success-soft text-success",
};

// "Domínio próprio" ainda não é uma feature de verdade (o painel não tem
// página pública por tenant hoje) — mostrado por pedido do usuário mesmo
// assim, pra tirar depois se não fizer sentido manter.
const DOMINIO_POR_PLANO: Record<PlanoId, string> = {
  basico: "Domínio próprio",
  pro: "Múltiplos domínios",
  plus: "Múltiplos domínios",
};

function formatarPrecoPlano(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diasRestantes(dataIso: string): number {
  return Math.max(0, Math.ceil((new Date(dataIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function Assinatura({ onAtualizar }: { onAtualizar?: () => void } = {}) {
  const [assinatura, setAssinatura] = useState<StatusAssinatura | null>(null);
  const [planos, setPlanos] = useState<PlanoInfo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<PlanoId | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([api<StatusAssinatura>("/assinatura"), api<PlanoInfo[]>("/assinatura/planos")]);
      setAssinatura(a);
      setPlanos(p);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function assinar(plano: PlanoInfo) {
    if (!confirm(`Ir pro Mercado Pago pra assinar o plano ${plano.nome} (${formatarPrecoPlano(plano.precoCentavos)}/mês)?`)) {
      return;
    }
    setProcessando(plano.id);
    try {
      const { initPoint } = await api<{ initPoint: string }>("/assinatura/checkout", {
        method: "POST",
        body: JSON.stringify({ plano: plano.id }),
      });
      window.location.href = initPoint;
    } catch (err) {
      toast.error(mensagemAmigavel(err));
      setProcessando(null);
    }
  }

  async function verificar() {
    setVerificando(true);
    try {
      const a = await api<StatusAssinatura>("/assinatura/verificar", { method: "POST" });
      setAssinatura(a);
      if (a.acessoLiberado) {
        toast.success("Assinatura confirmada!");
        onAtualizar?.();
      } else {
        toast.info("Ainda não identifiquei o pagamento — se acabou de pagar, aguarde um minuto e tente de novo.");
      }
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setVerificando(false);
    }
  }

  async function cancelar() {
    if (!confirm("Cancelar sua assinatura? Você perde o acesso assim que ela deixar de estar ativa.")) return;
    setCancelando(true);
    try {
      await api("/assinatura/cancelar", { method: "POST" });
      toast.success("Assinatura cancelada.");
      await carregar();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setCancelando(false);
    }
  }

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        titulo="Assinatura"
        subtitulo="Escolha o plano que combina com o tamanho da sua operação — dá pra trocar quando quiser."
      />

      {assinatura?.status && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2.5">
            <Badge className={`text-[11px] uppercase ${VARIANTE_STATUS[assinatura.status] ?? ""}`}>
              {ROTULO_STATUS[assinatura.status] ?? assinatura.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {assinatura.status === "trial" && assinatura.trialExpiraEm && (
                <>Restam {diasRestantes(assinatura.trialExpiraEm)} dia(s) de teste grátis.</>
              )}
              {assinatura.status === "ativa" && assinatura.proximaCobrancaEm && (
                <>Próxima cobrança em {new Date(assinatura.proximaCobrancaEm).toLocaleDateString("pt-BR")}.</>
              )}
              {assinatura.status === "pendente" && <>Aguardando confirmação do pagamento.</>}
            </span>
          </div>
          <div className="flex gap-2">
            {assinatura.status === "pendente" && (
              <Button size="sm" variant="outline" onClick={verificar} disabled={verificando}>
                <RefreshCw className="h-3.5 w-3.5" />
                Já paguei, verificar
              </Button>
            )}
            {(assinatura.status === "ativa" || assinatura.status === "atrasada") && (
              <Button size="sm" variant="destructive" onClick={cancelar} disabled={cancelando}>
                <XCircle className="h-3.5 w-3.5" />
                Cancelar assinatura
              </Button>
            )}
          </div>
        </div>
      )}

      {assinatura?.status === "isenta" ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground shadow-soft">
          Essa conta é isenta de cobrança — não precisa (e não dá pra) assinar um plano por aqui.
        </p>
      ) : (
        <>
          <div className="grid gap-4 pt-3 sm:grid-cols-3">
            {planos.map((plano) => {
              // "trial" NUNCA conta como "plano atual" pro botão — é só teste
              // grátis, não uma assinatura paga de verdade (bug real: card do
              // Básico mostrava "Plano atual" desabilitado pra quem tinha
              // acabado de se cadastrar, dando a impressão de já estar
              // assinado sem nunca ter pago nada). Continua destacando o card
              // visualmente (é o plano "correspondente" ao trial), mas o botão
              // deixa claro que é possível assinar de verdade a qualquer hora,
              // encerrando o teste na hora.
              const ehPlanoAtivo = assinatura?.plano === plano.id && assinatura.status === "ativa";
              const emTrialNessePlano = assinatura?.plano === plano.id && assinatura.status === "trial";
              const recomendado = plano.id === "pro";
              return (
                <div
                  key={plano.id}
                  className={cn(
                    "relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft",
                    recomendado && "border-2 border-primary shadow-soft-hover sm:-mt-2 sm:mb-2",
                    (ehPlanoAtivo || emTrialNessePlano) && !recomendado && "border-primary ring-1 ring-primary",
                  )}
                >
                  {recomendado && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-soft">
                      Mais popular
                    </span>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{plano.nome}</h3>
                    <p className="text-2xl font-bold text-primary">
                      {formatarPrecoPlano(plano.precoCentavos)}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>
                  </div>
                  <ul className="flex flex-1 flex-col gap-1.5 text-sm text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      {plano.limiteCanais} canal(is) de destino
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      {plano.limiteGruposMonitorados} grupo(s) monitorado(s)
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Mercado Livre + Shopee
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Produtos ilimitados
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Sem marca d'água
                    </li>
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      {DOMINIO_POR_PLANO[plano.id]}
                    </li>
                  </ul>
                  {emTrialNessePlano && <p className="text-xs text-warning">Em teste grátis — ainda não é uma assinatura paga.</p>}
                  <Button
                    variant={recomendado ? "default" : "outline"}
                    onClick={() => assinar(plano)}
                    disabled={processando === plano.id || ehPlanoAtivo}
                  >
                    <CreditCard className="h-4 w-4" />
                    {ehPlanoAtivo ? "Plano atual" : emTrialNessePlano ? "Assinar agora" : "Assinar"}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Pagamento 100% seguro, processado pelo Mercado Pago.
          </p>
        </>
      )}
    </div>
  );
}
