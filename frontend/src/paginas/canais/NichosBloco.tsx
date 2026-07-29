import { useState } from "react";
import { toast } from "sonner";
import { api, mensagemAmigavel } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import type { NichoRow } from "./tipos";

export function NichosBloco({ nichos, onMudou }: { nichos: NichoRow[]; onMudou: () => void }) {
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
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nichos</h3>
      <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
        Categorias já configuradas pro Mercado Livre e pra Shopee — só ativa ou desativa quais entram na captura.
      </p>

      <div className="flex flex-col divide-y overflow-hidden rounded-md border bg-card shadow-sm">
        {nichos.map((n) => (
          <label key={n.id} className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-medium">{n.nome}</span>
            <Switch
              checked={n.ativo}
              disabled={salvando === n.id}
              onCheckedChange={(v) => alternarAtivo(n, v)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
