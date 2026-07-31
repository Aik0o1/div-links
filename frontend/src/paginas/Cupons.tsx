import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ticket, Satellite, CheckCircle2, XCircle, Clock } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { buscarGruposMonitoradosDisponiveis, type GrupoMonitoradoOpcao } from "@/lib/gruposMonitorados";
import { Badge } from "@/components/ui/badge";
import type { CanalRow } from "@/paginas/canais/tipos";

interface CodigoExtraido {
  codigo: string | null;
  descricaoLivre?: string;
}

interface DisparoCupom {
  canalId: number;
  status: string;
  enviadoEm: string | null;
}

type Plataforma = "shopee" | "mercado_livre" | "aliexpress" | "amazon" | "magalu" | "desconhecida";

interface CupomRow {
  id: number;
  texto: string;
  recebidoEm: string;
  grupoOrigemId: string | null;
  codigos: CodigoExtraido[];
  plataforma: Plataforma;
  disparos: DisparoCupom[];
}

const ROTULO_PLATAFORMA: Record<Plataforma, string> = {
  shopee: "Shopee",
  mercado_livre: "Mercado Livre",
  aliexpress: "AliExpress",
  amazon: "Amazon",
  magalu: "Magalu",
  desconhecida: "Site não identificado",
};

// Só Shopee e Mercado Livre têm despacho automático (ver repassarCupons.ts) — os demais ficam só capturados.
const PLATAFORMAS_COM_DESPACHO = new Set<Plataforma>(["shopee", "mercado_livre"]);

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function StatusDisparo({
  disparos,
  canais,
  plataforma,
}: {
  disparos: DisparoCupom[];
  canais: CanalRow[];
  plataforma: Plataforma;
}) {
  if (!PLATAFORMAS_COM_DESPACHO.has(plataforma)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Sem despacho automático pra esse site ainda — só capturado
      </span>
    );
  }
  if (disparos.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Pendente
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {disparos.map((d, i) => {
        const canal = canais.find((c) => c.id === d.canalId);
        const enviado = d.status === "enviado";
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
              enviado ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {enviado ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {canal?.nome || `Canal #${d.canalId}`}
          </span>
        );
      })}
    </div>
  );
}

export default function Cupons() {
  const [cupons, setCupons] = useState<CupomRow[]>([]);
  const [grupos, setGrupos] = useState<GrupoMonitoradoOpcao[]>([]);
  const [canais, setCanais] = useState<CanalRow[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    Promise.all([
      api<CupomRow[]>("/cupons"),
      buscarGruposMonitoradosDisponiveis(),
      api<CanalRow[]>("/canais"),
    ])
      .then(([c, g, ca]) => {
        setCupons(c);
        setGrupos(g);
        setCanais(ca);
      })
      .catch((err) => toast.error(mensagemAmigavel(err)))
      .finally(() => setCarregando(false));
  }, []);

  const nomeGrupo = (id: string | null) => {
    if (!id) return null;
    return grupos.find((g) => g.id === id)?.nome ?? id;
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight">
        <Ticket className="h-5 w-5 text-primary" />
        Cupons capturados
      </h2>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Cupons genéricos (não ligados a um produto específico) reconhecidos em grupos monitorados, de onde vieram e
        pra quais canais já foram repassados.
      </p>

      {carregando ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : cupons.length === 0 ? (
        <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          Nenhum cupom capturado ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {cupons.map((cupom) => (
            <div key={cupom.id} className="rounded-md border bg-card p-4 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={PLATAFORMAS_COM_DESPACHO.has(cupom.plataforma) ? "default" : "outline"}>
                    {ROTULO_PLATAFORMA[cupom.plataforma]}
                  </Badge>
                  {cupom.grupoOrigemId && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Satellite className="h-3.5 w-3.5" />
                      {nomeGrupo(cupom.grupoOrigemId)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{formatarData(cupom.recebidoEm)}</span>
              </div>

              {cupom.codigos.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {cupom.codigos.map((c, i) => (
                    <Badge key={i} variant="outline" className="font-mono">
                      {c.codigo ?? c.descricaoLivre ?? "?"}
                    </Badge>
                  ))}
                </div>
              )}

              <pre className="mb-3 whitespace-pre-wrap break-words rounded bg-muted/50 p-2.5 text-xs text-muted-foreground">
                {cupom.texto}
              </pre>

              <StatusDisparo disparos={cupom.disparos} canais={canais} plataforma={cupom.plataforma} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
