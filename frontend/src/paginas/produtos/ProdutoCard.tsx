import { useState } from "react";
import { toast } from "sonner";
import { Wand2, Save, Eye, Trash2, Send } from "lucide-react";
import { api, formatarPreco, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FONTES_MONITORADAS, ROTULOS_FONTE, type ProdutoRow, type CanalElegivel } from "./tipos";

const VARIANTE_STATUS: Record<string, string> = {
  enviado: "bg-success-soft text-success",
  capturado: "bg-warning-soft text-warning",
  falhou: "bg-destructive-soft text-destructive",
};

export function ProdutoCard({ produto, onRemovido }: { produto: ProdutoRow; onRemovido: (id: number) => void }) {
  const [chamada, setChamada] = useState(produto.chamada ?? "");
  const [gerando, setGerando] = useState(false);
  const [salvandoChamada, setSalvandoChamada] = useState(false);
  const [canaisAbertos, setCanaisAbertos] = useState(false);
  const [canais, setCanais] = useState<CanalElegivel[] | null>(null);
  const [disparando, setDisparando] = useState<number | null>(null);
  const [removendo, setRemovendo] = useState(false);

  const ehMonitorado = FONTES_MONITORADAS.has(produto.fonte);
  const temDesconto =
    produto.precoOriginal && produto.precoPromocional && produto.precoOriginal > produto.precoPromocional;

  async function gerarChamada() {
    setGerando(true);
    try {
      const { chamada: nova } = await api<{ chamada: string }>(`/produtos/${produto.id}/gerar-chamada`, { method: "POST" });
      setChamada(nova);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setGerando(false);
    }
  }

  async function salvarChamada() {
    setSalvandoChamada(true);
    try {
      await api(`/produtos/${produto.id}/chamada`, { method: "PUT", body: JSON.stringify({ chamada }) });
      toast.success("Chamada salva.");
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvandoChamada(false);
    }
  }

  async function alternarCanais() {
    if (canaisAbertos) {
      setCanaisAbertos(false);
      return;
    }
    setCanaisAbertos(true);
    try {
      const c = await api<CanalElegivel[]>(`/produtos/${produto.id}/canais-elegiveis`);
      setCanais(c);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }

  async function disparar(canalId: number) {
    setDisparando(canalId);
    try {
      await api(`/produtos/${produto.id}/disparar/${canalId}`, { method: "POST" });
      toast.success("Disparado com sucesso!");
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setDisparando(null);
    }
  }

  async function apagar() {
    if (!confirm("Apagar esse produto? Não pode ser desfeito.")) return;
    setRemovendo(true);
    try {
      await api(`/produtos/${produto.id}`, { method: "DELETE" });
      toast.success("Produto apagado.");
      onRemovido(produto.id);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
      setRemovendo(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md">
      <img src={produto.imagemUrl ?? ""} alt="" className="h-[170px] w-full bg-muted object-contain" />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[11px] uppercase">
            {produto.nicho || "-"}
          </Badge>
          <Badge className={`text-[11px] uppercase ${VARIANTE_STATUS[produto.status] ?? ""}`}>{produto.status}</Badge>
          <Badge
            variant={ehMonitorado ? "default" : "secondary"}
            className={`text-[11px] uppercase ${ehMonitorado ? "bg-accent text-accent-foreground" : ""}`}
          >
            {ROTULOS_FONTE[produto.fonte] || produto.fonte}
          </Badge>
        </div>

        {ehMonitorado && produto.grupoOrigemNome && (
          <p className="-mt-1 text-xs text-muted-foreground">Grupo: {produto.grupoOrigemNome}</p>
        )}

        <p className="text-sm font-semibold leading-snug">{produto.titulo || "(sem título)"}</p>

        <div className="text-sm">
          {temDesconto && (
            <span className="mr-1.5 text-text-faint line-through">{formatarPreco(produto.precoOriginal)}</span>
          )}
          <span className="text-base font-bold text-destructive">
            {formatarPreco(produto.precoPromocional ?? produto.precoOriginal)}
          </span>
        </div>

        <Input
          placeholder="Chamada (frase de efeito)"
          value={chamada}
          onChange={(e) => setChamada(e.target.value)}
          className="h-9 text-xs"
        />
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={gerarChamada} disabled={gerando}>
            <Wand2 className="h-3.5 w-3.5" />
            Gerar com IA
          </Button>
          <Button size="sm" className="flex-1 text-xs" onClick={salvarChamada} disabled={salvandoChamada}>
            <Save className="h-3.5 w-3.5" />
            Salvar
          </Button>
        </div>

        <Button variant="outline" size="sm" className="text-xs" onClick={alternarCanais}>
          <Eye className="h-3.5 w-3.5" />
          Ver canais elegíveis
        </Button>

        {canaisAbertos && (
          <div className="rounded-md bg-muted p-2 text-xs">
            {canais === null ? (
              <p className="text-muted-foreground">Carregando...</p>
            ) : (
              canais.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between gap-2 border-t py-1.5 first:border-t-0 ${c.elegivel ? "" : "text-text-faint"}`}
                >
                  <span>
                    #{c.id} {c.nome ? <strong>{c.nome}</strong> : null} — {c.tipo} ({c.identificadorGrupo})
                    {c.motivo ? ` — ${c.motivo}` : ""}
                  </span>
                  {c.elegivel && (
                    <Button size="sm" className="h-6 px-2 text-[11px]" onClick={() => disparar(c.id)} disabled={disparando === c.id}>
                      <Send className="h-3 w-3" />
                      Disparar
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <Button variant="destructive" size="sm" className="mt-auto text-xs" onClick={apagar} disabled={removendo}>
          <Trash2 className="h-3.5 w-3.5" />
          Apagar
        </Button>
      </div>
    </div>
  );
}
