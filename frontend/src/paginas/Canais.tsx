import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/TopBar";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CanalDialog } from "./canais/CanalDialog";
import { NichosBloco } from "./canais/NichosBloco";
import type { CanalRow, NichoRow } from "./canais/tipos";

export default function Canais() {
  const [canais, setCanais] = useState<CanalRow[]>([]);
  const [nichos, setNichos] = useState<NichoRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [canalEditando, setCanalEditando] = useState<CanalRow | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [c, n] = await Promise.all([api<CanalRow[]>("/canais"), api<NichoRow[]>("/nichos")]);
      setCanais(c);
      setNichos(n);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternarAtivo(canal: CanalRow, ativo: boolean) {
    setCanais((atual) => atual.map((c) => (c.id === canal.id ? { ...c, ativo } : c)));
    try {
      await api(`/canais/${canal.id}`, { method: "PUT", body: JSON.stringify({ ativo }) });
    } catch (err) {
      toast.error(mensagemAmigavel(err));
      setCanais((atual) => atual.map((c) => (c.id === canal.id ? { ...c, ativo: !ativo } : c)));
    }
  }

  async function remover(canal: CanalRow) {
    if (!confirm(`Remover o canal #${canal.id}?`)) return;
    try {
      await api(`/canais/${canal.id}`, { method: "DELETE" });
      toast.success("Canal removido.");
      carregar();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }

  function abrirCriar() {
    setCanalEditando(null);
    setDialogAberto(true);
  }

  function abrirEditar(canal: CanalRow) {
    setCanalEditando(canal);
    setDialogAberto(true);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        titulo="Canais de destino"
        subtitulo="Gerencie os grupos e canais onde as promoções são distribuídas."
        acao={
          <Button onClick={abrirCriar}>
            <Plus className="h-4 w-4" />
            Adicionar canal
          </Button>
        }
      />

      <div className="mb-8 overflow-hidden rounded-lg border border-border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ativo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Identificador</TableHead>
              <TableHead className="text-right">Desconto mín.</TableHead>
              <TableHead className="text-right">Intervalo mín.</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!carregando && canais.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Nenhum canal cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {canais.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Switch checked={c.ativo} onCheckedChange={(v) => alternarAtivo(c, v)} />
                </TableCell>
                <TableCell className="font-medium">{c.nome || <span className="text-muted-foreground">sem nome</span>}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent capitalize",
                      c.tipo === "whatsapp" ? "bg-[#25D366]/10 text-[#128C4A]" : "bg-[#0088cc]/10 text-[#0088cc]",
                    )}
                  >
                    {c.tipo}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                  {c.identificadorGrupo}
                </TableCell>
                <TableCell className="text-right">{c.descontoMinimo}%</TableCell>
                <TableCell className="text-right">{c.intervaloMinimoMinutos} min</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="icon-sm" title="Configurar" onClick={() => abrirEditar(c)}>
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon-sm" title="Remover" onClick={() => remover(c)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NichosBloco nichos={nichos} canais={canais} onMudou={carregar} />

      <CanalDialog
        aberto={dialogAberto}
        onFechar={() => setDialogAberto(false)}
        canal={canalEditando}
        nichos={nichos}
        onSalvo={carregar}
      />
    </div>
  );
}
