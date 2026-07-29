import { useEffect, useState, useCallback } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { GraficoDisparos, type PontoHora } from "@/components/GraficoDisparos";
import type { Aba } from "@/App";

interface Metricas {
  enviadosHoje: number;
  falhasHoje: number;
  capturadosHoje: number;
  pendentes: number;
  porHora: PontoHora[];
}

interface ItemPreRequisito {
  id: string;
  label: string;
  ok: boolean;
  obrigatorio: boolean;
  dica: string;
  aba: string;
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

export default function Dashboard({ onNavegar }: { onNavegar: (aba: Aba) => void }) {
  const [status, setStatus] = useState<StatusSistema | null>(null);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [itensPreReq, setItensPreReq] = useState<ItemPreRequisito[] | null>(null);
  const [disparoAtivo, setDisparoAtivo] = useState(false);
  const [carregandoAcao, setCarregandoAcao] = useState(false);

  const carregarTudo = useCallback(async () => {
    try {
      const [s, m, p, d] = await Promise.all([
        api<StatusSistema>("/status"),
        api<Metricas>("/dashboard/metricas"),
        api<{ itens: ItemPreRequisito[] }>("/dashboard/pre-requisitos"),
        api<{ ativo: boolean }>("/disparo-automatico"),
      ]);
      setStatus(s);
      setMetricas(m);
      setItensPreReq(p.itens);
      setDisparoAtivo(d.ativo);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }, []);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  const pendentesObrigatorios = itensPreReq?.filter((i) => i.obrigatorio && !i.ok) ?? [];

  async function iniciar() {
    setCarregandoAcao(true);
    try {
      await api("/disparo-automatico/iniciar", { method: "POST" });
      toast.success("Disparo automático iniciado.");
      await carregarTudo();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
      await carregarTudo();
    } finally {
      setCarregandoAcao(false);
    }
  }

  async function pausar() {
    setCarregandoAcao(true);
    try {
      await api("/disparo-automatico/pausar", { method: "POST" });
      toast.success("Disparo automático pausado.");
      await carregarTudo();
    } finally {
      setCarregandoAcao(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
        <Button variant="outline" size="sm" onClick={carregarTudo}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {itensPreReq &&
        (pendentesObrigatorios.length === 0 ? (
          <div className="mb-3.5 flex items-start gap-3 rounded-md border-l-4 border-l-success bg-success-soft p-3.5">
            <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-success" />
            <div>
              <p className="font-semibold">Tudo pronto pra ligar o disparo automático</p>
              <p className="text-sm text-muted-foreground">Todos os pré-requisitos estão configurados.</p>
            </div>
          </div>
        ) : (
          <div className="mb-3.5 flex flex-col gap-2">
            {pendentesObrigatorios.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-md border-l-4 border-l-warning bg-warning-soft p-3.5"
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

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4 rounded-md border-l-4 border-l-text-faint bg-card p-4 shadow-sm">
        <div>
          <h3 className="font-semibold">Disparo automático</h3>
          <p className="text-sm text-muted-foreground">
            {disparoAtivo
              ? "Rodando — verificando os canais a cada 1 minuto e disparando sozinho."
              : "Pausado — nenhum disparo automático vai acontecer até você clicar em Iniciar."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={iniciar}
            disabled={carregandoAcao || disparoAtivo || pendentesObrigatorios.length > 0}
          >
            <Play className="h-4 w-4" />
            Iniciar
          </Button>
          <Button variant="destructive" onClick={pausar} disabled={carregandoAcao || !disparoAtivo}>
            <Pause className="h-4 w-4" />
            Pausar
          </Button>
        </div>
      </div>

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoje</h3>
      {metricas && (
        <>
          <div className="mb-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CardMetrica titulo="Enviados hoje" valor={metricas.enviadosHoje} destaque={metricas.enviadosHoje > 0 ? "success" : undefined} />
            <CardMetrica titulo="Falhas hoje" valor={metricas.falhasHoje} destaque={metricas.falhasHoje > 0 ? "destructive" : undefined} />
            <CardMetrica titulo="Capturados hoje" valor={metricas.capturadosHoje} />
            <CardMetrica titulo="Fila pendente" valor={metricas.pendentes} />
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
  destaque,
}: {
  titulo: string;
  valor: number;
  destaque?: "success" | "destructive";
}) {
  return (
    <div
      className={cnBorda(destaque)}
    >
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h4>
      <p className="text-2xl font-bold">{valor}</p>
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
      <p className="font-semibold">{ok ? valorOk : valorErro}</p>
    </div>
  );
}

function cnBorda(destaque?: "success" | "destructive") {
  const base = "rounded-md border-l-4 bg-card p-4 shadow-sm transition-shadow hover:shadow-md";
  if (destaque === "success") return `${base} border-l-success`;
  if (destaque === "destructive") return `${base} border-l-destructive`;
  return `${base} border-l-text-faint`;
}
