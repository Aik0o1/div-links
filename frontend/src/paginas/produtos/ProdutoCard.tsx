import { useState } from "react";
import { toast } from "sonner";
import { Save, Eye, Trash2, Send, Pencil } from "lucide-react";
import { api, formatarPreco, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FONTES_MONITORADAS, ROTULOS_FONTE, type ProdutoRow, type CanalElegivel } from "./tipos";

const VARIANTE_STATUS: Record<string, string> = {
  enviado: "bg-success-soft text-success",
  capturado: "bg-warning-soft text-warning",
  falhou: "bg-destructive-soft text-destructive",
};

interface FormEdicao {
  titulo: string;
  precoOriginal: string;
  precoPromocional: string;
  imagemUrl: string;
  cupom: string;
}

function formEdicaoInicial(produto: ProdutoRow): FormEdicao {
  return {
    titulo: produto.titulo ?? "",
    precoOriginal: produto.precoOriginal != null ? String(produto.precoOriginal) : "",
    precoPromocional: produto.precoPromocional != null ? String(produto.precoPromocional) : "",
    imagemUrl: produto.imagemUrl ?? "",
    cupom: produto.cupom ?? "",
  };
}

export function ProdutoCard({
  produto,
  onRemovido,
  onAtualizado,
}: {
  produto: ProdutoRow;
  onRemovido: (id: number) => void;
  onAtualizado: (produto: ProdutoRow) => void;
}) {
  const [chamada, setChamada] = useState(produto.chamada ?? "");
  const [salvandoChamada, setSalvandoChamada] = useState(false);
  const [canaisAbertos, setCanaisAbertos] = useState(false);
  const [canais, setCanais] = useState<CanalElegivel[] | null>(null);
  const [disparando, setDisparando] = useState<number | null>(null);
  const [removendo, setRemovendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [formEdicao, setFormEdicao] = useState<FormEdicao>(() => formEdicaoInicial(produto));
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const ehMonitorado = FONTES_MONITORADAS.has(produto.fonte);
  const temDesconto =
    produto.precoOriginal && produto.precoPromocional && produto.precoOriginal > produto.precoPromocional;

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

  function abrirEdicao() {
    setFormEdicao(formEdicaoInicial(produto));
    setEditando(true);
  }

  async function salvarEdicao() {
    if (!formEdicao.titulo.trim()) {
      toast.error("Título não pode ficar vazio.");
      return;
    }
    setSalvandoEdicao(true);
    try {
      const atualizado = await api<ProdutoRow>(`/produtos/${produto.id}`, {
        method: "PUT",
        body: JSON.stringify({
          titulo: formEdicao.titulo.trim(),
          precoOriginal: formEdicao.precoOriginal.trim() === "" ? null : Number(formEdicao.precoOriginal),
          precoPromocional: formEdicao.precoPromocional.trim() === "" ? null : Number(formEdicao.precoPromocional),
          imagemUrl: formEdicao.imagemUrl.trim() || null,
          cupom: formEdicao.cupom.trim() || null,
        }),
      });
      toast.success("Produto atualizado.");
      onAtualizado(atualizado);
      setEditando(false);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvandoEdicao(false);
    }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-soft transition-shadow hover:shadow-soft-hover">
      <div className="relative">
        <img src={produto.imagemUrl ?? ""} alt="" className="h-[170px] w-full bg-muted object-contain" />
        <Button
          variant="outline"
          size="icon-sm"
          title="Editar produto"
          className="absolute right-2 top-2 bg-card/90"
          onClick={abrirEdicao}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
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

        {produto.cupom && (
          <p className="-mt-1 text-xs text-muted-foreground">
            Cupom: <span className="font-mono font-medium text-foreground">{produto.cupom}</span>
          </p>
        )}

        <Input
          placeholder="Chamada (frase de efeito)"
          value={chamada}
          onChange={(e) => setChamada(e.target.value)}
          className="h-9 text-xs"
        />
        <Button size="sm" className="text-xs" onClick={salvarChamada} disabled={salvandoChamada}>
          <Save className="h-3.5 w-3.5" />
          Salvar chamada
        </Button>

        <Button variant="outline" size="sm" className="text-xs" onClick={alternarCanais}>
          <Eye className="h-3.5 w-3.5" />
          Ver canais elegíveis
        </Button>

        {canaisAbertos && (
          <div className="rounded-lg bg-muted p-2 text-xs">
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

      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar produto</DialogTitle>
            <DialogDescription>Ajusta título, preços, imagem ou cupom — não muda nicho nem origem.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edicao-titulo">Título</Label>
              <Input
                id="edicao-titulo"
                value={formEdicao.titulo}
                onChange={(e) => setFormEdicao((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edicao-preco-de">Preço "De:"</Label>
                <Input
                  id="edicao-preco-de"
                  type="number"
                  step="0.01"
                  placeholder="Sem preço original"
                  value={formEdicao.precoOriginal}
                  onChange={(e) => setFormEdicao((f) => ({ ...f, precoOriginal: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edicao-preco-por">Preço "Por:"</Label>
                <Input
                  id="edicao-preco-por"
                  type="number"
                  step="0.01"
                  placeholder="Sem preço promocional"
                  value={formEdicao.precoPromocional}
                  onChange={(e) => setFormEdicao((f) => ({ ...f, precoPromocional: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edicao-imagem">URL da imagem</Label>
              <Input
                id="edicao-imagem"
                placeholder="https://..."
                value={formEdicao.imagemUrl}
                onChange={(e) => setFormEdicao((f) => ({ ...f, imagemUrl: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edicao-cupom">Cupom</Label>
              <Input
                id="edicao-cupom"
                placeholder="Sem cupom"
                value={formEdicao.cupom}
                onChange={(e) => setFormEdicao((f) => ({ ...f, cupom: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={salvandoEdicao}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
