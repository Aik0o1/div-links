import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Satellite, CheckCircle2, XCircle, Clock, Trash2, Plus } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { buscarGruposMonitoradosDisponiveis, type GrupoMonitoradoOpcao } from "@/lib/gruposMonitorados";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/TopBar";
import type { CanalRow } from "@/paginas/canais/tipos";

interface CodigoExtraido {
  codigo: string | null;
  descricaoLivre?: string;
}

interface DisparoCupom {
  canalId: number;
  status: string;
  enviadoEm: string | null;
}

type Plataforma = "shopee" | "mercado_livre" | "aliexpress" | "amazon" | "magalu" | "desconhecida";

interface CupomRow {
  id: number;
  texto: string;
  recebidoEm: string;
  grupoOrigemId: string | null;
  codigos: CodigoExtraido[];
  plataforma: Plataforma;
  disparos: DisparoCupom[];
}

const ROTULO_PLATAFORMA: Record<Plataforma, string> = {
  shopee: "Shopee",
  mercado_livre: "Mercado Livre",
  aliexpress: "AliExpress",
  amazon: "Amazon",
  magalu: "Magalu",
  desconhecida: "Site não identificado",
};

// Só Shopee e Mercado Livre têm despacho automático (ver repassarCupons.ts) — os demais ficam só capturados.
const PLATAFORMAS_COM_DESPACHO = new Set<Plataforma>(["shopee", "mercado_livre"]);

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function StatusDisparo({
  disparos,
  canais,
  plataforma,
}: {
  disparos: DisparoCupom[];
  canais: CanalRow[];
  plataforma: Plataforma;
}) {
  if (!PLATAFORMAS_COM_DESPACHO.has(plataforma)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Sem despacho automático pra esse site ainda — só capturado
      </span>
    );
  }
  if (disparos.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Pendente
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {disparos.map((d, i) => {
        const canal = canais.find((c) => c.id === d.canalId);
        const enviado = d.status === "enviado";
        return (
          <span
            key={i}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
              enviado ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {enviado ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {canal?.nome || `Canal #${d.canalId}`}
          </span>
        );
      })}
    </div>
  );
}

const EXEMPLO_TEXTO = "cupom: PROMO20\n20% OFF em R$50+";

/**
 * Cria cupom(s) direto pelo painel, sem depender de captura de grupo
 * monitorado — mesmo parser de sempre (extrairCupons no backend) valida o
 * texto, por isso o formato é o mesmo de uma mensagem de grupo real ("cupom:
 * CODIGO" + desconto na linha seguinte), repetido quantas vezes precisar
 * pra virar uma lista.
 */
function CriarCupomDialog({ onCriado }: { onCriado: (cupom: CupomRow) => void }) {
  const [aberto, setAberto] = useState(false);
  const [plataforma, setPlataforma] = useState<"mercado_livre" | "shopee">("mercado_livre");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  function aoAbrir(novoAberto: boolean) {
    if (novoAberto) {
      setPlataforma("mercado_livre");
      setTexto("");
    }
    setAberto(novoAberto);
  }

  async function salvar() {
    setSalvando(true);
    try {
      const cupom = await api<CupomRow>("/cupons/manual", {
        method: "POST",
        body: JSON.stringify({ plataforma, texto }),
      });
      toast.success("Cupom criado.");
      onCriado(cupom);
      setAberto(false);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => aoAbrir(true)}>
        <Plus className="h-4 w-4" />
        Criar cupom
      </Button>

      <Dialog open={aberto} onOpenChange={aoAbrir}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar cupom</DialogTitle>
            <DialogDescription>
              Escreva um cupom ou uma lista deles, no mesmo formato de um post de grupo — uma linha "cupom: CODIGO" e
              o desconto na linha seguinte.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cupom-plataforma">Plataforma</Label>
              <Select value={plataforma} onValueChange={(v) => setPlataforma(v as typeof plataforma)}>
                <SelectTrigger id="cupom-plataforma">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                  <SelectItem value="shopee">Shopee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cupom-texto">Cupom ou lista de cupons</Label>
              <Textarea
                id="cupom-texto"
                rows={6}
                placeholder={EXEMPLO_TEXTO}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Exemplo: "{EXEMPLO_TEXTO.replace("\n", '" na linha de baixo "')}" — pra vários, repita esse bloco
                separado por uma linha em branco.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={salvar} disabled={salvando || !texto.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Cupons() {
  const [cupons, setCupons] = useState<CupomRow[]>([]);
  const [grupos, setGrupos] = useState<GrupoMonitoradoOpcao[]>([]);
  const [canais, setCanais] = useState<CanalRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [apagando, setApagando] = useState(false);

  useEffect(() => {
    carregarTudo();
  }, []);

  function carregarTudo() {
    setCarregando(true);
    Promise.all([
      api<CupomRow[]>("/cupons"),
      buscarGruposMonitoradosDisponiveis(),
      api<CanalRow[]>("/canais"),
    ])
      .then(([c, g, ca]) => {
        setCupons(c);
        setGrupos(g);
        setCanais(ca);
      })
      .catch((err) => toast.error(mensagemAmigavel(err)))
      .finally(() => setCarregando(false));
  }

  async function apagarTudo() {
    if (!confirm("Apagar TODOS os cupons capturados (inclusive o histórico de repasses deles)? Essa ação não pode ser desfeita.")) {
      return;
    }
    setApagando(true);
    try {
      await api("/cupons", { method: "DELETE" });
      toast.success("Cupons apagados.");
      setCupons([]);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setApagando(false);
    }
  }

  const nomeGrupo = (id: string | null) => {
    if (!id) return null;
    return grupos.find((g) => g.id === id)?.nome ?? id;
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        titulo="Cupons capturados"
        subtitulo="Cupons genéricos reconhecidos em grupos monitorados, de onde vieram e pra quais canais já foram repassados."
        acao={
          <div className="flex gap-2">
            <CriarCupomDialog onCriado={(novo) => setCupons((atual) => [novo, ...atual])} />
            <Button variant="destructive" onClick={apagarTudo} disabled={apagando || cupons.length === 0}>
              <Trash2 className="h-4 w-4" />
              Apagar tudo
            </Button>
          </div>
        }
      />

      {carregando ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
      ) : cupons.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
          Nenhum cupom capturado ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {cupons.map((cupom) => (
            <div key={cupom.id} className="rounded-lg border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-soft-hover">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={PLATAFORMAS_COM_DESPACHO.has(cupom.plataforma) ? "default" : "outline"}>
                    {ROTULO_PLATAFORMA[cupom.plataforma]}
                  </Badge>
                  {cupom.grupoOrigemId && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Satellite className="h-3.5 w-3.5" />
                      {nomeGrupo(cupom.grupoOrigemId)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{formatarData(cupom.recebidoEm)}</span>
              </div>

              {cupom.codigos.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {cupom.codigos.map((c, i) => (
                    <Badge key={i} variant="outline" className="font-mono">
                      {c.codigo ?? c.descricaoLivre ?? "?"}
                    </Badge>
                  ))}
                </div>
              )}

              <pre className="mb-3 whitespace-pre-wrap break-words rounded bg-muted/50 p-2.5 text-xs text-muted-foreground">
                {cupom.texto}
              </pre>

              <StatusDisparo disparos={cupom.disparos} canais={canais} plataforma={cupom.plataforma} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
