import { useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { NichoRow } from "./tipos";

export function NichosBloco({ nichos, onMudou }: { nichos: NichoRow[]; onMudou: () => void }) {
  const [edicoes, setEdicoes] = useState<Record<string, { ativo: boolean; categoriaIds: string }>>({});
  const [novo, setNovo] = useState({ id: "", nome: "", categoriaIds: "" });
  const [criando, setCriando] = useState(false);

  function estado(n: NichoRow) {
    return edicoes[n.id] ?? { ativo: n.ativo, categoriaIds: n.categoriaIds.join(", ") };
  }

  function atualizarEdicao(id: string, parcial: Partial<{ ativo: boolean; categoriaIds: string }>) {
    const n = nichos.find((n) => n.id === id)!;
    setEdicoes((e) => ({ ...e, [id]: { ...estado(n), ...parcial } }));
  }

  async function salvar(n: NichoRow) {
    const { ativo, categoriaIds } = estado(n);
    try {
      await api(`/nichos/${n.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ativo,
          categoriaIds: categoriaIds.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      toast.success(`Nicho "${n.id}" salvo.`);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }

  async function remover(n: NichoRow) {
    if (!confirm(`Remover o nicho "${n.id}"?`)) return;
    try {
      await api(`/nichos/${n.id}`, { method: "DELETE" });
      onMudou();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }

  async function adicionar() {
    if (!novo.id || !novo.nome || !novo.categoriaIds) return;
    setCriando(true);
    try {
      await api("/nichos", {
        method: "POST",
        body: JSON.stringify({
          id: novo.id,
          nome: novo.nome,
          categoriaIds: novo.categoriaIds.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      setNovo({ id: "", nome: "", categoriaIds: "" });
      toast.success("Nicho adicionado.");
      onMudou();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setCriando(false);
    }
  }

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nichos</h3>
      <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
        Cada nicho busca direto nas categorias reais do Mercado Livre (aba Ofertas). Pra descobrir o ID de uma
        categoria: abra{" "}
        <a className="text-primary underline" href="https://www.mercadolivre.com.br/ofertas" target="_blank" rel="noreferrer">
          mercadolivre.com.br/ofertas
        </a>
        , clique numa categoria na barra lateral e veja o <code>?category=MLB...</code> na URL.
      </p>

      <div className="mb-3 overflow-hidden rounded-md border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ativo</TableHead>
              <TableHead className="w-40">Nome</TableHead>
              <TableHead>IDs de categoria (separados por vírgula)</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nichos.map((n) => {
              const e = estado(n);
              return (
                <TableRow key={n.id}>
                  <TableCell>
                    <Checkbox checked={e.ativo} onCheckedChange={(v) => atualizarEdicao(n.id, { ativo: v === true })} />
                  </TableCell>
                  <TableCell className="font-medium">{n.nome}</TableCell>
                  <TableCell>
                    <Input
                      value={e.categoriaIds}
                      onChange={(ev) => atualizarEdicao(n.id, { categoriaIds: ev.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="icon-sm" title="Salvar" onClick={() => salvar(n)}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon-sm" title="Remover" onClick={() => remover(n)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card p-3.5 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">id</label>
          <Input
            placeholder="ex: esportes"
            className="h-9 w-32"
            value={novo.id}
            onChange={(e) => setNovo((n) => ({ ...n, id: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input
            placeholder="ex: Esportes"
            className="h-9 w-40"
            value={novo.nome}
            onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">IDs de categoria</label>
          <Input
            placeholder="ex: MLB1276"
            className="h-9 w-44"
            value={novo.categoriaIds}
            onChange={(e) => setNovo((n) => ({ ...n, categoriaIds: e.target.value }))}
          />
        </div>
        <Button onClick={adicionar} disabled={criando || !novo.id || !novo.nome || !novo.categoriaIds}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}
