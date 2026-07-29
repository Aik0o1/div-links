import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, mensagemAmigavel } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FONTES_CANAL, type CanalRow, type NichoRow } from "./tipos";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  canal: CanalRow | null; // null = criar novo
  nichos: NichoRow[];
  onSalvo: () => void;
}

interface FormState {
  nome: string;
  tipo: "whatsapp" | "telegram";
  identificadorGrupo: string;
  descontoMinimo: string;
  intervaloMinimoMinutos: string;
  ativo: boolean;
  geral: boolean;
  nichosSelecionados: string[];
  fontesSelecionadas: string[];
  gruposSelecionados: string[];
}

function estadoInicial(canal: CanalRow | null): FormState {
  const categorias = canal?.categoriasPermitidas ?? [];
  return {
    nome: canal?.nome ?? "",
    tipo: canal?.tipo ?? "telegram",
    identificadorGrupo: canal?.identificadorGrupo ?? "",
    descontoMinimo: String(canal?.descontoMinimo ?? 0),
    intervaloMinimoMinutos: String(canal?.intervaloMinimoMinutos ?? 15),
    ativo: canal?.ativo ?? true,
    geral: categorias.length === 0,
    nichosSelecionados: categorias,
    fontesSelecionadas: canal?.fontesPermitidas ?? [],
    gruposSelecionados: canal?.gruposMonitoradosPermitidos ?? [],
  };
}

interface GrupoMonitoradoOpcao {
  id: string;
  nome: string;
  plataforma: "whatsapp" | "telegram";
}

/** Combina as rotas de grupo monitorado + listagem já existentes (mesmo padrão de GruposMonitorados.tsx) — sem endpoint novo. */
async function buscarGruposMonitoradosDisponiveis(): Promise<GrupoMonitoradoOpcao[]> {
  const [wMonitorados, wGrupos, tStatus, tGrupos] = await Promise.all([
    api<{ id: string; nicho: string }[]>("/whatsapp/grupos-monitorados").catch(() => []),
    api<{ jid: string; nome: string }[]>("/whatsapp/grupos").catch(() => []),
    api<{ gruposMonitorados: { id: string; nicho: string }[] }>("/telegram-listener/status").catch(() => ({
      gruposMonitorados: [],
    })),
    api<{ id: string; nome: string }[]>("/telegram-listener/grupos").catch(() => []),
  ]);

  const nomesWhats = new Map(wGrupos.map((g) => [g.jid, g.nome]));
  const nomesTelegram = new Map(tGrupos.map((g) => [g.id, g.nome]));

  return [
    ...wMonitorados.map((g) => ({ id: g.id, nome: nomesWhats.get(g.id) ?? g.id, plataforma: "whatsapp" as const })),
    ...tStatus.gruposMonitorados.map((g) => ({
      id: g.id,
      nome: nomesTelegram.get(g.id) ?? g.id,
      plataforma: "telegram" as const,
    })),
  ];
}

export function CanalDialog({ aberto, onFechar, canal, nichos, onSalvo }: Props) {
  const [form, setForm] = useState<FormState>(() => estadoInicial(canal));
  const [salvando, setSalvando] = useState(false);
  const [gruposDisponiveis, setGruposDisponiveis] = useState<GrupoMonitoradoOpcao[]>([]);
  const editando = canal !== null;

  useEffect(() => {
    if (aberto) {
      setForm(estadoInicial(canal));
      buscarGruposMonitoradosDisponiveis().then(setGruposDisponiveis);
    }
  }, [aberto, canal]);

  function alternarNicho(id: string, marcado: boolean) {
    setForm((f) => ({
      ...f,
      nichosSelecionados: marcado ? [...f.nichosSelecionados, id] : f.nichosSelecionados.filter((n) => n !== id),
    }));
  }

  function alternarFonte(valor: string, marcado: boolean) {
    setForm((f) => ({
      ...f,
      fontesSelecionadas: marcado ? [...f.fontesSelecionadas, valor] : f.fontesSelecionadas.filter((v) => v !== valor),
    }));
  }

  function alternarGrupo(id: string, marcado: boolean) {
    setForm((f) => ({
      ...f,
      gruposSelecionados: marcado ? [...f.gruposSelecionados, id] : f.gruposSelecionados.filter((g) => g !== id),
    }));
  }

  async function salvar() {
    setSalvando(true);
    try {
      const categoriasPermitidas = form.geral ? [] : form.nichosSelecionados;
      if (editando) {
        await api(`/canais/${canal.id}`, {
          method: "PUT",
          body: JSON.stringify({
            nome: form.nome,
            identificadorGrupo: form.identificadorGrupo,
            descontoMinimo: Number(form.descontoMinimo),
            intervaloMinimoMinutos: Number(form.intervaloMinimoMinutos),
            ativo: form.ativo,
            categoriasPermitidas,
            fontesPermitidas: form.fontesSelecionadas,
            gruposMonitoradosPermitidos: form.gruposSelecionados,
          }),
        });
        toast.success(`Canal "${form.nome || canal.identificadorGrupo}" salvo.`);
      } else {
        await api("/canais", {
          method: "POST",
          body: JSON.stringify({
            nome: form.nome,
            tipo: form.tipo,
            identificadorGrupo: form.identificadorGrupo,
            descontoMinimo: Number(form.descontoMinimo),
            intervaloMinimoMinutos: Number(form.intervaloMinimoMinutos),
            categoriasPermitidas,
            fontesPermitidas: form.fontesSelecionadas,
            gruposMonitoradosPermitidos: form.gruposSelecionados,
          }),
        });
        toast.success("Canal criado.");
      }
      onSalvo();
      onFechar();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? "Configurar canal" : "Adicionar canal"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Dados básicos, nicho e origem aceita — tudo salvo de uma vez."
              : "Crie um novo canal de destino e já defina nicho e origem."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="canal-nome">Nome</Label>
              <Input
                id="canal-nome"
                placeholder="ex: Grupo Ofertas VIP"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              {editando ? (
                <div>
                  <Badge variant="secondary" className="h-9 px-3 text-sm capitalize">
                    {canal.tipo}
                  </Badge>
                </div>
              ) : (
                <Select value={form.tipo} onValueChange={(v: "whatsapp" | "telegram") => setForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telegram">telegram</SelectItem>
                    <SelectItem value="whatsapp">whatsapp</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="canal-identificador">Identificador</Label>
              <Input
                id="canal-identificador"
                placeholder="chat_id ou JID"
                value={form.identificadorGrupo}
                onChange={(e) => setForm((f) => ({ ...f, identificadorGrupo: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="canal-desconto">Desconto mín. (%)</Label>
              <Input
                id="canal-desconto"
                type="number"
                value={form.descontoMinimo}
                onChange={(e) => setForm((f) => ({ ...f, descontoMinimo: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="canal-intervalo">Intervalo mín. (min)</Label>
              <Input
                id="canal-intervalo"
                type="number"
                value={form.intervaloMinimoMinutos}
                onChange={(e) => setForm((f) => ({ ...f, intervaloMinimoMinutos: e.target.value }))}
              />
            </div>

            {editando && (
              <div className="col-span-2 flex items-center gap-2.5 pt-1">
                <Switch id="canal-ativo" checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
                <Label htmlFor="canal-ativo">Canal ativo</Label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-md border bg-muted/40 p-3.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nicho</span>
              <RadioGroup
                value={form.geral ? "geral" : "especifico"}
                onValueChange={(v) => setForm((f) => ({ ...f, geral: v === "geral" }))}
                className="gap-1.5"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                  <RadioGroupItem value="geral" />
                  Geral (todos os nichos)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                  <RadioGroupItem value="especifico" />
                  Nichos específicos:
                </label>
              </RadioGroup>
              <div className="ml-6 flex flex-col gap-1">
                {nichos
                  .filter((n) => n.id !== "geral")
                  .map((n) => (
                    <label
                      key={n.id}
                      className="flex cursor-pointer items-center gap-2 text-sm font-normal data-[disabled]:opacity-50"
                      data-disabled={form.geral || undefined}
                    >
                      <Checkbox
                        disabled={form.geral}
                        checked={form.nichosSelecionados.includes(n.id)}
                        onCheckedChange={(v) => alternarNicho(n.id, v === true)}
                      />
                      {n.nome}
                    </label>
                  ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Origem</span>
              <div className="flex flex-col gap-1">
                {FONTES_CANAL.map((f) => (
                  <label key={f.valor} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={form.fontesSelecionadas.includes(f.valor)}
                      onCheckedChange={(v) => alternarFonte(f.valor, v === true)}
                    />
                    {f.rotulo}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Nenhuma marcada = aceita qualquer origem</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 rounded-md border bg-muted/40 p-3.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Grupos monitorados
            </span>
            {gruposDisponiveis.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum grupo monitorado configurado ainda (ver aba Grupos monitorados).
              </p>
            ) : (
              <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                {gruposDisponiveis.map((g) => (
                  <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={form.gruposSelecionados.includes(g.id)}
                      onCheckedChange={(v) => alternarGrupo(g.id, v === true)}
                    />
                    {g.nome}
                    <span className="text-xs text-muted-foreground capitalize">({g.plataforma})</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Nenhum marcado = sem restrição por grupo (nicho/origem mandam). Grupo marcado aqui entra mesmo se o
              nicho dele não estiver liberado acima.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || !form.identificadorGrupo}>
            {editando ? "Salvar" : "Criar canal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
