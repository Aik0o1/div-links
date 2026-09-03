import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/TopBar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProdutoCard } from "./produtos/ProdutoCard";
import { AdicionarProdutoDialog } from "./produtos/AdicionarProdutoDialog";
import type { ProdutoRow } from "./produtos/tipos";

interface NichoRow {
  id: string;
  nome: string;
  ativo: boolean;
}

const ABA_MONITORADOS = "__monitorados__";

export default function Produtos() {
  const [nichos, setNichos] = useState<NichoRow[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<string>("geral");
  const [limpando, setLimpando] = useState(false);
  // Muda a cada limpeza bem-sucedida e entra no `key` de cada AbaProdutos —
  // força remontar (e portanto refazer o fetch inicial) todas as abas de
  // uma vez. Sem isso, `DELETE /produtos` limpava no banco mas a tela só
  // refletia depois de um F5 manual: `setAbaAtiva((a) => a)` (tentativa
  // anterior) reatribui o mesmo valor de string, então o React nem
  // re-renderiza, e cada AbaProdutos só busca dados no próprio mount.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api<NichoRow[]>("/nichos").then((todos) => setNichos(todos.filter((n) => n.ativo)));
  }, []);

  async function limparTudo() {
    if (!confirm("Apagar TODOS os produtos (inclusive já enviados e o histórico de disparos deles)? Essa ação não pode ser desfeita.")) {
      return;
    }
    setLimpando(true);
    try {
      await api("/produtos", { method: "DELETE" });
      toast.success("Produtos apagados.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setLimpando(false);
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Produtos"
        subtitulo="Capture e gerencie o catálogo por nicho, com chamada e disparo por canal."
        acao={
          <Button variant="destructive" onClick={limparTudo} disabled={limpando}>
            <Trash2 className="h-4 w-4" />
            Limpar todos os produtos
          </Button>
        }
      />

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
        <TabsList className="mb-4 h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {nichos.map((n) => (
            <TabsTrigger
              key={n.id}
              value={n.id}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full border px-3.5 py-1.5"
            >
              {n.nome}
            </TabsTrigger>
          ))}
          <TabsTrigger
            value={ABA_MONITORADOS}
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full border px-3.5 py-1.5"
          >
            Grupos monitorados
          </TabsTrigger>
        </TabsList>

        {nichos.map((n) => (
          <TabsContent key={n.id} value={n.id}>
            <AbaProdutos key={`${n.id}-${refreshKey}`} fixedNicho={n.id} mostrarCapturar />
          </TabsContent>
        ))}
        <TabsContent value={ABA_MONITORADOS}>
          <AbaProdutos key={`monitorados-${refreshKey}`} fixedFonte="monitorados" mostrarCapturar={false} nichosParaFiltro={nichos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AbaProdutos({
  fixedNicho,
  fixedFonte,
  mostrarCapturar,
  nichosParaFiltro,
}: {
  fixedNicho?: string;
  fixedFonte?: "monitorados";
  mostrarCapturar: boolean;
  nichosParaFiltro?: NichoRow[];
}) {
  const [produtos, setProdutos] = useState<ProdutoRow[]>([]);
  const [filtroStatus, setFiltroStatus] = useState("__todos__");
  const [filtroNicho, setFiltroNicho] = useState("__todos__");
  const [carregando, setCarregando] = useState(true);
  const [capturando, setCapturando] = useState(false);
  const [resultadoCaptura, setResultadoCaptura] = useState("");

  const carregarProdutos = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroStatus !== "__todos__") params.set("status", filtroStatus);
      if (fixedNicho) params.set("nicho", fixedNicho);
      else if (filtroNicho !== "__todos__") params.set("nicho", filtroNicho);
      if (fixedFonte) params.set("fonte", fixedFonte);
      const p = await api<ProdutoRow[]>(`/produtos?${params}`);
      setProdutos(p);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, filtroNicho, fixedNicho, fixedFonte]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  function removerDaLista(id: number) {
    setProdutos((atual) => atual.filter((p) => p.id !== id));
  }

  function atualizarNaLista(produtoAtualizado: ProdutoRow) {
    setProdutos((atual) => atual.map((p) => (p.id === produtoAtualizado.id ? produtoAtualizado : p)));
  }

  async function capturar() {
    if (!fixedNicho) return;
    setCapturando(true);
    setResultadoCaptura("");
    try {
      const [ml, shopee] = await Promise.all([
        api<{ novos: number; duplicados: number; ignorados: number; total: number }>(
          `/produtos/capturar?nicho=${fixedNicho}`,
          { method: "POST" },
        ),
        api<{ novos: number; duplicados: number; total: number }>(`/produtos/capturar-shopee?nicho=${fixedNicho}`, {
          method: "POST",
        }),
      ]);
      const novos = ml.novos + shopee.novos;
      const duplicados = ml.duplicados + shopee.duplicados;
      setResultadoCaptura(
        `${novos} produto(s) novo(s), ${duplicados} já existente(s), ${ml.ignorados} ignorado(s) do Mercado Livre (sem nicho/desconto).`,
      );
      carregarProdutos();
    } catch (err) {
      setResultadoCaptura(`Erro: ${mensagemAmigavel(err)}`);
    } finally {
      setCapturando(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtrar</span>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos os status</SelectItem>
              <SelectItem value="capturado">capturado</SelectItem>
              <SelectItem value="enviado">enviado</SelectItem>
              <SelectItem value="falhou">falhou</SelectItem>
            </SelectContent>
          </Select>
          {!fixedNicho && nichosParaFiltro && (
            <Select value={filtroNicho} onValueChange={setFiltroNicho}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos os nichos</SelectItem>
                {nichosParaFiltro.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {mostrarCapturar && (
          <Button onClick={capturar} disabled={capturando}>
            <Download className="h-4 w-4" />
            {capturando ? "Capturando..." : "Capturar"}
          </Button>
        )}
        {fixedNicho && <AdicionarProdutoDialog nicho={fixedNicho} onAdicionado={carregarProdutos} />}
      </div>

      {resultadoCaptura && <p className="mb-3 text-sm text-muted-foreground">{resultadoCaptura}</p>}

      {!carregando && produtos.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum produto encontrado com esses filtros.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {produtos.map((p) => (
          <ProdutoCard key={p.id} produto={p} onRemovido={removerDaLista} onAtualizado={atualizarNaLista} />
        ))}
      </div>
    </div>
  );
}
