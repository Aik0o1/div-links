import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Home, Gamepad2, Infinity as InfinityIcon, Baby, Shirt, PawPrint, Cpu, Tag, type LucideIcon } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import type { CanalRow, NichoRow } from "./tipos";

const ICONE_POR_PALAVRA: [RegExp, LucideIcon][] = [
  [/beleza/i, Sparkles],
  [/casa|decora/i, Home],
  [/gamer|game/i, Gamepad2],
  [/geral/i, InfinityIcon],
  [/maternidade|bebê|bebe/i, Baby],
  [/moda/i, Shirt],
  [/pet/i, PawPrint],
  [/tecnologia|tech/i, Cpu],
];

function iconeDoNicho(nome: string): LucideIcon {
  return ICONE_POR_PALAVRA.find(([re]) => re.test(nome))?.[1] ?? Tag;
}

// Paleta rotativa (mesmo espírito do bento-grid colorido do mockup) — cor
// decorativa por posição, não carrega nenhum significado semântico.
const CORES = ["bg-primary/10 text-primary", "bg-warning/10 text-warning", "bg-success/10 text-success", "bg-accent text-accent-foreground"];

/** Quantos canais ATIVOS aceitam esse nicho — canal sem `categoriasPermitidas`
 * (nulo ou vazio) é "geral" e aceita qualquer nicho, então conta também. */
function contarCanaisAtivos(nichoId: string, canais: CanalRow[]): number {
  return canais.filter(
    (c) => c.ativo && (!c.categoriasPermitidas || c.categoriasPermitidas.length === 0 || c.categoriasPermitidas.includes(nichoId)),
  ).length;
}

export function NichosBloco({
  nichos,
  canais,
  onMudou,
}: {
  nichos: NichoRow[];
  canais: CanalRow[];
  onMudou: () => void;
}) {
  const [salvando, setSalvando] = useState<string | null>(null);

  async function alternarAtivo(n: NichoRow, ativo: boolean) {
    setSalvando(n.id);
    try {
      await api(`/nichos/${n.id}`, { method: "PUT", body: JSON.stringify({ ativo }) });
      onMudou();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Filtro global de nichos
      </h3>
      <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
        Categorias já configuradas pro Mercado Livre e pra Shopee — só ativa ou desativa quais entram na captura.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {nichos.map((n, i) => {
          const Icon = iconeDoNicho(n.nome);
          const qtd = contarCanaisAtivos(n.id, canais);
          return (
            <div
              key={n.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-soft-hover"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full", CORES[i % CORES.length])}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{n.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {qtd} {qtd === 1 ? "canal ativo" : "canais ativos"}
                  </p>
                </div>
              </div>
              <Switch checked={n.ativo} disabled={salvando === n.id} onCheckedChange={(v) => alternarAtivo(n, v)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
