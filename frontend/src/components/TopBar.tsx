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

/** Barra fixa no topo do conteúdo com o título da aba atual e o controle
 * global de iniciar/pausar o disparo automático — substitui o "Pause
 * All"/"Deploy Bot" dos mockups por uma ação real (ver `[[disparoAutomatico]]`). */
export function TopBar({ aba, disparo }: { aba: Aba; disparo: DisparoAutomatico }) {
  const { ativo, carregando, carregandoAcao, pendentesObrigatorios, iniciar, pausar } = disparo;
  const bloqueado = pendentesObrigatorios.length > 0;

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
      <h2 className="text-lg font-bold tracking-tight text-foreground">{TITULOS[aba]}</h2>

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
