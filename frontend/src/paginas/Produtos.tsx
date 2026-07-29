import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Download, ShoppingBag, Trash2 } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProdutoCard } from "./produtos/ProdutoCard";
import type { ProdutoRow } from "./produtos/tipos";

interface NichoRow {
  id: string;
  nome: string;
}

export default function Produtos() {
  const [produtos, setProdutos] = useState<ProdutoRow[]>([]);
  const [nichos, setNichos] = useState<NichoRow[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>("__todos__");
  const [filtroNicho, setFiltroNicho] = useState<string>("__todos__");
  const [filtroFonte, setFiltroFonte] = useState<string>("__todos__");
  const [carregando, setCarregando] = useState(true);
  const [capturandoML, setCapturandoML] = useState(false);
  const [capturandoShopee, setCapturandoShopee] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [resultadoCaptura, setResultadoCaptura] = useState("");

  const carregarProdutos = useCallback(async () => {
    setCarregando(true);
    try {
      const params = new URLSearchParams();
      if (filtroStatus !== "__todos__") params.set("status", filtroStatus);
      if (filtroNicho !== "__todos__") params.set("nicho", filtroNicho);
      if (filtroFonte !== "__todos__") params.set("fonte", filtroFonte);
      const p = await api<ProdutoRow[]>(`/produtos?${params}`);
      setProdutos(p);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setCarregando(false);
    }
  }, [filtroStatus, filtroNicho, filtroFonte]);

  useEffect(() => {
    api<NichoRow[]>("/nichos").then(setNichos).catch(() => {});
  }, []);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  function removerDaLista(id: number) {
    setProdutos((atual) => atual.filter((p) => p.id !== id));
  }

  async function capturarML() {
    setCapturandoML(true);
    setResultadoCaptura("");
    try {
      const r = await api<{ novos: number; duplicados: number; ignorados: number }>("/produtos/capturar", { method: "POST" });
      setResultadoCaptura(`${r.novos} produto(s) novo(s), ${r.duplicados} já existente(s), ${r.ignorados} ignorado(s) (sem nicho/desconto).`);
      carregarProdutos();
    } catch (err) {
      setResultadoCaptura(`Erro: ${mensagemAmigavel(err)}`);
    } finally {
      setCapturandoML(false);
    }
  }

  async function capturarShopee() {
    setCapturandoShopee(true);
    setResultadoCaptura("");
    try {
      const r = await api<{ novos: number; duplicados: number; total: number }>("/produtos/capturar-shopee", { method: "POST" });
      setResultadoCaptura(`Shopee: ${r.novos} produto(s) novo(s), ${r.duplicados} já existente(s) (de ${r.total} ofertas encontradas).`);
      carregarProdutos();
    } catch (err) {
      setResultadoCaptura(`Erro: ${mensagemAmigavel(err)}`);
    } finally {
      setCapturandoShopee(false);
    }
  }

  async function limparTudo() {
    if (!confirm("Apagar TODOS os produtos (inclusive já enviados e o histórico de disparos deles)? Essa ação não pode ser desfeita.")) {
      return;
    }
    setLimpando(true);
    try {
      await api("/produtos", { method: "DELETE" });
      toast.success("Produtos apagados.");
      carregarProdutos();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setLimpando(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Produtos</h2>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtrar</span>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos os status</SelectItem>
              <SelectItem value="capturado">capturado</SelectItem>
              <SelectItem value="enviado">enviado</SelectItem>
              <SelectItem value="falhou">falhou</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroNicho} onValueChange={setFiltroNicho}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todos os nichos</SelectItem>
              {nichos.map((n) => (
                <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroFonte} onValueChange={setFiltroFonte}>
            <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todos__">Todas as origens</SelectItem>
              <SelectItem value="mercado_livre">Mercado Livre (captura)</SelectItem>
              <SelectItem value="shopee">Shopee (captura + grupos)</SelectItem>
              <SelectItem value="monitorados">Grupos monitorados (todos)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capturar novos</span>
          <Button onClick={capturarML} disabled={capturandoML}>
            <Download className="h-4 w-4" />
            {capturandoML ? "Capturando..." : "Mercado Livre"}
          </Button>
          <Button onClick={capturarShopee} disabled={capturandoShopee}>
            <ShoppingBag className="h-4 w-4" />
            {capturandoShopee ? "Capturando..." : "Shopee"}
          </Button>
        </div>

        <Button variant="destructive" className="ml-auto" onClick={limparTudo} disabled={limpando}>
          <Trash2 className="h-4 w-4" />
          Limpar todos os produtos
        </Button>
      </div>

      {resultadoCaptura && <p className="mb-3 text-sm text-muted-foreground">{resultadoCaptura}</p>}

      {!carregando && produtos.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum produto encontrado com esses filtros.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {produtos.map((p) => (
          <ProdutoCard key={p.id} produto={p} onRemovido={removerDaLista} />
        ))}
      </div>
    </div>
  );
}
