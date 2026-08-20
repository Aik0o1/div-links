import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ListChecks, Save } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Grupo {
  id: string;
  nome: string;
}

interface NichoRow {
  id: string;
  nome: string;
}

interface GrupoMonitorado {
  id: string;
  nicho: string;
  /** Nome de exibição do grupo — usado pra mostrar "veio do grupo X" na aba Produtos. */
  nome?: string;
}

function BlocoPlataforma({
  titulo,
  descricao,
  buscarGrupos,
  buscarMonitorados,
  salvar,
}: {
  titulo: string;
  descricao: string;
  buscarGrupos: () => Promise<Grupo[]>;
  buscarMonitorados: () => Promise<GrupoMonitorado[]>;
  salvar: (grupos: GrupoMonitorado[]) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [nichos, setNichos] = useState<NichoRow[]>([]);
  const [selecao, setSelecao] = useState<Record<string, string | null>>({});
  const [salvando, setSalvando] = useState(false);

  async function alternar() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setAberto(true);
    setCarregando(true);
    try {
      const [g, m, n] = await Promise.all([buscarGrupos(), buscarMonitorados(), api<NichoRow[]>("/nichos")]);
      setGrupos(g);
      setNichos(n);
      const mapa: Record<string, string | null> = {};
      for (const item of m) mapa[item.id] = item.nicho;
      setSelecao(mapa);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setCarregando(false);
    }
  }

  function alternarGrupo(id: string, marcado: boolean) {
    setSelecao((s) => ({ ...s, [id]: marcado ? "geral" : null }));
  }

  function mudarNicho(id: string, nicho: string) {
    setSelecao((s) => ({ ...s, [id]: nicho }));
  }

  async function salvarSelecao() {
    setSalvando(true);
    try {
      const grupos2 = Object.entries(selecao)
        .filter(([, nicho]) => nicho !== null)
        .map(([id, nicho]) => ({ id, nicho: nicho!, nome: grupos.find((g) => g.id === id)?.nome }));
      await salvar(grupos2);
      toast.success(`Grupos monitorados do ${titulo} salvos.`);
      setAberto(false);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mb-6">
      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border-l-4 border-l-text-faint bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">{descricao}</p>
        <Button variant="outline" onClick={alternar}>
          <ListChecks className="h-4 w-4" />
          Grupos monitorados
        </Button>
      </div>

      {aberto && (
        <div className="mt-2 rounded-md border bg-card p-3.5 shadow-sm">
          {carregando ? (
            <p className="py-2 text-sm text-muted-foreground">Carregando grupos...</p>
          ) : grupos.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Nenhum grupo encontrado (conecte a conta e certifique-se de que ela já participa de algum grupo).
            </p>
          ) : (
            <>
              {grupos.map((g) => {
                const nichoAtual = selecao[g.id];
                const marcado = nichoAtual !== undefined && nichoAtual !== null;
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3 border-t py-2 first:border-t-0">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={marcado} onCheckedChange={(v) => alternarGrupo(g.id, v === true)} />
                      {g.nome}
                    </label>
                    <Select
                      value={marcado ? nichoAtual! : "geral"}
                      onValueChange={(v) => mudarNicho(g.id, v)}
                      disabled={!marcado}
                    >
                      <SelectTrigger className="h-8 w-40">
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
                  </div>
                );
              })}
              <Button className="mt-3" onClick={salvarSelecao} disabled={salvando}>
                <Save className="h-4 w-4" />
                Salvar seleção
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function GruposMonitorados() {
  const [nichosDisponiveis, setNichosDisponiveis] = useState(true);

  useEffect(() => {
    api<NichoRow[]>("/nichos")
      .then((n) => setNichosDisponiveis(n.length > 0))
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-1 text-xl font-bold tracking-tight">Grupos monitorados</h2>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Marque os grupos de terceiros que quer monitorar — cupons e produtos novos são reconhecidos automaticamente e
        repassados pros seus canais ativos, respeitando o nicho escolhido por grupo.
      </p>
      {!nichosDisponiveis && (
        <p className="mb-4 text-sm text-warning">Nenhum nicho cadastrado ainda — cadastre em Canais/Grupos primeiro.</p>
      )}

      <BlocoPlataforma
        titulo="WhatsApp"
        descricao="Selecione quais grupos do WhatsApp monitorar."
        buscarGrupos={() =>
          api<{ jid: string; nome: string }[]>("/whatsapp/grupos").then((grupos) =>
            grupos.map((g) => ({ id: g.jid, nome: g.nome })),
          )
        }
        buscarMonitorados={() => api("/whatsapp/grupos-monitorados")}
        salvar={(grupos) => api("/whatsapp/grupos-monitorados", { method: "POST", body: JSON.stringify({ grupos }) })}
      />

      <BlocoPlataforma
        titulo="Telegram"
        descricao="Selecione quais grupos/canais do Telegram monitorar."
        buscarGrupos={() => api("/telegram-listener/grupos")}
        buscarMonitorados={() =>
          api<{ gruposMonitorados: GrupoMonitorado[] }>("/telegram-listener/status").then((s) => s.gruposMonitorados)
        }
        salvar={(grupos) => api("/telegram-listener/grupos-monitorados", { method: "POST", body: JSON.stringify({ grupos }) })}
      />
    </div>
  );
}
