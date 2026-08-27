import { useEffect, useState } from "react";
import { toast } from "sonner";
import { mensagemAmigavel, api } from "@/lib/api";
import { buscarTodosDialogosComStatus, marcarGruposComoMonitorados, type DialogoComStatus } from "@/lib/gruposMonitorados";
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

const NICHO_PADRAO_GRUPO = "geral";

export function CanalDialog({ aberto, onFechar, canal, nichos, onSalvo }: Props) {
  const [form, setForm] = useState<FormState>(() => estadoInicial(canal));
  const [salvando, setSalvando] = useState(false);
  const [gruposDisponiveis, setGruposDisponiveis] = useState<DialogoComStatus[]>([]);
  // Nicho escolhido pra cada grupo marcado (não só os já monitorados antes)
  // — pré-preenchido com o nicho global já configurado, quando existir.
  const [nichoPorGrupo, setNichoPorGrupo] = useState<Record<string, string>>({});
  const editando = canal !== null;

  useEffect(() => {
    if (aberto) {
      setForm(estadoInicial(canal));
      buscarTodosDialogosComStatus().then((grupos) => {
        setGruposDisponiveis(grupos);
        const mapa: Record<string, string> = {};
        for (const g of grupos) if (g.nichoAtual) mapa[g.id] = g.nichoAtual;
        setNichoPorGrupo(mapa);
      });
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

  // Atalho pro caso comum "só grupo monitorado" — equivalente a marcar só
  // "Grupos monitorados" nos checkboxes de Origem abaixo, mas explícito em
  // vez de depender do usuário perceber que deixar Mercado Livre/Shopee
  // desmarcados é o que faz isso funcionar.
  const soMonitorados = form.fontesSelecionadas.length === 1 && form.fontesSelecionadas[0] === "monitorados";
  function alternarSoMonitorados(ativo: boolean) {
    setForm((f) => ({ ...f, fontesSelecionadas: ativo ? ["monitorados"] : [] }));
  }

  function alternarGrupo(id: string, marcado: boolean) {
    setForm((f) => ({
      ...f,
      gruposSelecionados: marcado ? [...f.gruposSelecionados, id] : f.gruposSelecionados.filter((g) => g !== id),
    }));
    if (marcado) {
      setNichoPorGrupo((m) => (m[id] ? m : { ...m, [id]: NICHO_PADRAO_GRUPO }));
    }
  }

  function mudarNichoGrupo(id: string, nicho: string) {
    setNichoPorGrupo((m) => ({ ...m, [id]: nicho }));
  }

  async function salvar() {
    setSalvando(true);
    try {
      // Antes de salvar o canal em si, garante que todo grupo marcado aqui
      // está mesmo sendo monitorado globalmente (merge, nunca substitui a
      // lista de outro canal — ver marcarGruposComoMonitorados). É isso que
      // permite escolher/registrar um grupo novo direto daqui, sem passar
      // por uma aba separada antes.
      const gruposParaMarcar = form.gruposSelecionados
        .map((id) => gruposDisponiveis.find((g) => g.id === id))
        .filter((g): g is DialogoComStatus => g !== undefined)
        .map((g) => ({ id: g.id, nome: g.nome, plataforma: g.plataforma, nicho: nichoPorGrupo[g.id] ?? NICHO_PADRAO_GRUPO }));
      if (gruposParaMarcar.length > 0) {
        await marcarGruposComoMonitorados(gruposParaMarcar);
      }

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

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="canal-identificador">Identificador</Label>
              <Input
                id="canal-identificador"
                placeholder="chat_id ou JID"
                value={form.identificadorGrupo}
                onChange={(e) => setForm((f) => ({ ...f, identificadorGrupo: e.target.value }))}
              />
              {form.tipo === "telegram" ? (
                <p className="text-xs text-muted-foreground">
                  Como pegar: adicione seu bot no grupo → mande qualquer mensagem nele → abra{" "}
                  <code className="rounded bg-muted px-1">
                    https://api.telegram.org/bot&lt;SEU_TOKEN&gt;/getUpdates
                  </code>{" "}
                  no navegador (troque pelo token do <code className="rounded bg-muted px-1">TELEGRAM_BOT_TOKEN</code>{" "}
                  do seu <code className="rounded bg-muted px-1">.env</code>) → procure{" "}
                  <code className="rounded bg-muted px-1">"chat":{"{"}"id": -100...{"}"}</code> na resposta — esse
                  número é o identificador.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Como pegar: adicione o número do WhatsApp conectado no grupo → abra{" "}
                  <code className="rounded bg-muted px-1">/api/whatsapp/grupos</code> no navegador → ache o grupo
                  pelo nome na lista e copie o valor de <code className="rounded bg-muted px-1">jid</code> (termina
                  em <code className="rounded bg-muted px-1">@g.us</code>).
                </p>
              )}
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

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/40 p-3.5">
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

              <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-background p-2">
                <Switch checked={soMonitorados} onCheckedChange={alternarSoMonitorados} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Só grupos monitorados</span>
                  <span className="block text-xs text-muted-foreground">
                    Nunca recebe captura em massa (Mercado Livre/Shopee), só produto de grupo monitorado.
                  </span>
                </span>
              </label>

              <div className="mt-1 flex flex-col gap-1 border-t pt-1.5">
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

          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-3.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Grupos monitorados
            </span>
            <p className="text-xs text-muted-foreground">
              Marque de quais grupos (WhatsApp ou Telegram, de conta já conectada) esse canal recebe cupom/produto —
              marcar aqui já ativa o monitoramento desse grupo, com o nicho escolhido ao lado.
            </p>
            {gruposDisponiveis.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum grupo encontrado — conecte o WhatsApp e/ou o monitor de Telegram primeiro (aba Status).
              </p>
            ) : (
              <div className="flex max-h-56 flex-col gap-3 overflow-y-auto">
                {(["whatsapp", "telegram"] as const).map((plataforma) => {
                  const grupos = gruposDisponiveis.filter((g) => g.plataforma === plataforma);
                  if (grupos.length === 0) return null;
                  const cor = plataforma === "whatsapp" ? "#25D366" : "#0088cc";
                  return (
                    <div key={plataforma} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ backgroundColor: cor }}
                        >
                          {plataforma === "whatsapp" ? "W" : "T"}
                        </span>
                        <span className="text-xs font-semibold capitalize" style={{ color: cor }}>
                          {plataforma}
                        </span>
                        <span className="text-xs text-muted-foreground">({grupos.length})</span>
                      </div>
                      {grupos.map((g) => {
                        const marcado = form.gruposSelecionados.includes(g.id);
                        return (
                          <div key={g.id} className="flex items-center justify-between gap-2 pl-5.5">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm font-normal">
                              <Checkbox checked={marcado} onCheckedChange={(v) => alternarGrupo(g.id, v === true)} />
                              <span className="truncate">{g.nome}</span>
                            </label>
                            {marcado && (
                              <Select value={nichoPorGrupo[g.id] ?? NICHO_PADRAO_GRUPO} onValueChange={(v) => mudarNichoGrupo(g.id, v)}>
                                <SelectTrigger className="h-7 w-32 flex-shrink-0 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {nichos.map((n) => (
                                    <SelectItem key={n.id} value={n.id}>
                                      {n.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Nenhum marcado = sem restrição por grupo (nicho/origem acima mandam). Grupo marcado aqui entra nesse
              canal mesmo se o nicho dele não estiver liberado acima.
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
