import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { CreditCard, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import type { StatusAssinatura, PlanoInfo, PlanoId } from "@/lib/assinatura";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

  async function assinar(plano: PlanoId) {
    setProcessando(plano);
    try {
      const { initPoint } = await api<{ initPoint: string }>("/assinatura/checkout", {
        method: "POST",
        body: JSON.stringify({ plano }),
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
      <h2 className="mb-1 text-xl font-bold tracking-tight">Assinatura</h2>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Escolha o plano que combina com o tamanho da sua operação — dá pra trocar de plano quando quiser.
      </p>

      {assinatura?.status && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-4 shadow-sm">
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

      <div className="grid gap-4 sm:grid-cols-3">
        {planos.map((plano) => {
          const ehAtual = assinatura?.plano === plano.id && (assinatura.status === "ativa" || assinatura.status === "trial");
          return (
            <div
              key={plano.id}
              className={`flex flex-col gap-3 rounded-lg border bg-card p-5 shadow-sm ${ehAtual ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <div>
                <h3 className="text-lg font-bold">{plano.nome}</h3>
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
              </ul>
              <Button onClick={() => assinar(plano.id)} disabled={processando === plano.id || ehAtual}>
                <CreditCard className="h-4 w-4" />
                {ehAtual ? "Plano atual" : "Assinar"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
