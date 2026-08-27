import { useEffect, useState, useCallback } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Send, Package, Clock, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { GraficoDisparos, type PontoHora } from "@/components/GraficoDisparos";
import type { Aba } from "@/App";
import type { DisparoAutomatico } from "@/lib/disparoAutomatico";

interface Metricas {
  enviadosHoje: number;
  falhasHoje: number;
  capturadosHoje: number;
  pendentes: number;
  porHora: PontoHora[];
}

interface StatusSistema {
  db: boolean;
  redis: boolean;
  telegram: { configurado: boolean };
}

const ABA_POR_ID: Record<string, Aba> = {
  canais: "canais",
  whatsapp: "whatsapp",
  telegram: "telegram",
  afiliados: "afiliados",
};

export default function Dashboard({
  onNavegar,
  disparo,
}: {
  onNavegar: (aba: Aba) => void;
  disparo: DisparoAutomatico;
}) {
  const [status, setStatus] = useState<StatusSistema | null>(null);
  const [metricas, setMetricas] = useState<Metricas | null>(null);

  const carregarTudo = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([api<StatusSistema>("/status"), api<Metricas>("/dashboard/metricas")]);
      setStatus(s);
      setMetricas(m);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }, []);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  async function atualizar() {
    await Promise.all([carregarTudo(), disparo.recarregar()]);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" size="sm" onClick={atualizar}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {disparo.itensPreReq &&
        (disparo.pendentesObrigatorios.length === 0 ? (
          <div className="mb-3.5 flex items-start gap-3 rounded-lg border-l-4 border-l-success bg-success-soft p-3.5">
            <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-success" />
            <div>
              <p className="font-semibold">Tudo pronto pra ligar o disparo automático</p>
              <p className="text-sm text-muted-foreground">Todos os pré-requisitos estão configurados.</p>
            </div>
          </div>
        ) : (
          <div className="mb-3.5 flex flex-col gap-2">
            {disparo.pendentesObrigatorios.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border-l-4 border-l-warning bg-warning-soft p-3.5"
              >
                <AlertTriangle className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-warning" />
                <div className="flex-1">
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.dica}</p>
                </div>
                {ABA_POR_ID[item.aba] && (
                  <Button variant="outline" size="sm" onClick={() => onNavegar(ABA_POR_ID[item.aba])}>
                    Resolver
                  </Button>
                )}
              </div>
            ))}
          </div>
        ))}

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2.5">
          <span className={`h-2 w-2 rounded-full ${disparo.ativo ? "animate-pulse bg-success" : "bg-warning"}`} />
          <div>
            <h3 className="font-semibold text-foreground">Disparo automático</h3>
            <p className="text-sm text-muted-foreground">
              {disparo.ativo
                ? "Rodando — verificando os canais a cada 1 minuto e disparando sozinho."
                : "Pausado — controle em Iniciar/Pausar no topo da tela."}
            </p>
          </div>
        </div>
      </div>

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoje</h3>
      {metricas && (
        <>
          <div className="mb-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CardMetrica
              titulo="Enviados hoje"
              valor={metricas.enviadosHoje}
              Icon={Send}
              destaque={metricas.enviadosHoje > 0 ? "success" : undefined}
            />
            <CardMetrica
              titulo="Falhas hoje"
              valor={metricas.falhasHoje}
              Icon={XCircle}
              destaque={metricas.falhasHoje > 0 ? "destructive" : undefined}
            />
            <CardMetrica titulo="Capturados hoje" valor={metricas.capturadosHoje} Icon={Package} />
            <CardMetrica titulo="Fila pendente" valor={metricas.pendentes} Icon={Clock} />
          </div>
          <div className="mb-3.5">
            <GraficoDisparos porHora={metricas.porHora} />
          </div>
        </>
      )}

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status técnico</h3>
      {status && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CardStatus titulo="Banco de dados" ok={status.db} />
          <CardStatus titulo="Redis" ok={status.redis} />
          <CardStatus
            titulo="Telegram"
            ok={status.telegram.configurado}
            valorOk="bot configurado"
            valorErro="TELEGRAM_BOT_TOKEN ausente"
          />
        </div>
      )}
    </div>
  );
}

function CardMetrica({
  titulo,
  valor,
  Icon,
  destaque,
}: {
  titulo: string;
  valor: number;
  Icon: LucideIcon;
  destaque?: "success" | "destructive";
}) {
  return (
    <div className={cnBorda(destaque)}>
      <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <h4 className="text-xs font-semibold uppercase tracking-wide">{titulo}</h4>
      </div>
      <p className="text-3xl font-bold text-foreground">{valor}</p>
    </div>
  );
}

function CardStatus({
  titulo,
  ok,
  valorOk = "conectado",
  valorErro = "falhou",
}: {
  titulo: string;
  ok: boolean;
  valorOk?: string;
  valorErro?: string;
}) {
  return (
    <div className={cnBorda(ok ? "success" : "destructive")}>
      <div className="mb-1.5 flex items-center gap-1.5">
        {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h4>
      </div>
      <p className="font-semibold text-foreground">{ok ? valorOk : valorErro}</p>
    </div>
  );
}

function cnBorda(destaque?: "success" | "destructive") {
  const base = "rounded-lg border-l-4 bg-card p-4 shadow-soft transition-shadow hover:shadow-soft-hover";
  if (destaque === "success") return `${base} border-l-success`;
  if (destaque === "destructive") return `${base} border-l-destructive`;
  return `${base} border-l-text-faint`;
}
