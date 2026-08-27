import type { ReactNode } from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Aba } from "@/App";
import type { DisparoAutomatico } from "@/lib/disparoAutomatico";

const TITULOS: Record<Aba, string> = {
  dashboard: "Dashboard",
  afiliados: "Config. Afiliados",
  whatsapp: "Config. WhatsApp",
  telegram: "Config. Telegram",
  canais: "Canais/Grupos",
  produtos: "Produtos",
  cupons: "Cupons",
  assinatura: "Assinatura",
};

/** Barra fina e fixa no topo (só o rótulo da seção + o controle global de
 * disparo automático) — o título grande de cada página fica no conteúdo,
 * abaixo dela (ver `PageHeader`), igual ao padrão dos mockups (barra
 * utilitária fina em cima, headline grande dentro da página). */
export function TopBar({ aba, disparo }: { aba: Aba; disparo: DisparoAutomatico }) {
  const { ativo, carregando, carregandoAcao, pendentesObrigatorios, iniciar, pausar } = disparo;
  const bloqueado = pendentesObrigatorios.length > 0;

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{TITULOS[aba]}</span>

      {!carregando && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", ativo ? "animate-pulse bg-success" : "bg-warning")} />
            {ativo ? "Bot ativo" : "Pausado"}
          </span>
          {ativo ? (
            <Button size="sm" variant="destructive" onClick={pausar} disabled={carregandoAcao}>
              <Pause className="h-4 w-4" />
              Pausar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="success"
              onClick={iniciar}
              disabled={carregandoAcao || bloqueado}
              title={
                bloqueado
                  ? `Pendente: ${pendentesObrigatorios.map((i) => i.label).join(", ")}`
                  : undefined
              }
            >
              {carregandoAcao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Iniciar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Headline grande de página (36px, padrão "Overview"/"Products & Offers"
 * dos mockups) + subtítulo opcional + slot pra ação principal à direita. */
export function PageHeader({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      {acao && <div className="flex-shrink-0">{acao}</div>}
    </div>
  );
}
