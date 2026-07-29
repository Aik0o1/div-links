import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ExternalLink, Sparkles, Save } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function ConfigAfiliados() {
  const [chromeConectado, setChromeConectado] = useState(false);
  const [abrindoChrome, setAbrindoChrome] = useState(false);

  const [shopeeAppId, setShopeeAppId] = useState("");
  const [shopeeSecret, setShopeeSecret] = useState("");
  const [shopeeConfigurado, setShopeeConfigurado] = useState(false);
  const [salvandoShopee, setSalvandoShopee] = useState(false);

  const [chamadaIAAtiva, setChamadaIAAtiva] = useState(false);
  const [descontoMinimo, setDescontoMinimo] = useState("0");
  const [linkCupomFixo, setLinkCupomFixo] = useState("");
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [status, shopee, config] = await Promise.all([
        api<{ chrome: { conectado: boolean } }>("/status"),
        api<{ appId: string; configurado: boolean }>("/configuracoes/shopee"),
        api<{ descontoMinimo: number; linkCupomFixo: string | null; chamadaIAAtiva: boolean }>("/configuracoes"),
      ]);
      setChromeConectado(status.chrome.conectado);
      setShopeeAppId(shopee.appId);
      setShopeeConfigurado(shopee.configurado);
      setDescontoMinimo(String(config.descontoMinimo));
      setLinkCupomFixo(config.linkCupomFixo ?? "");
      setChamadaIAAtiva(config.chamadaIAAtiva);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function abrirChrome() {
    setAbrindoChrome(true);
    try {
      await api("/status/abrir-chrome", { method: "POST" });
      toast.success(
        "Janela do Chrome deve abrir em instantes. Faça login (com Google) e deixe a janela aberta — a sessão não sobrevive fechar/reabrir.",
      );
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setAbrindoChrome(false);
      setTimeout(carregar, 5000);
    }
  }

  async function salvarShopee() {
    setSalvandoShopee(true);
    try {
      await api("/configuracoes/shopee", { method: "PUT", body: JSON.stringify({ appId: shopeeAppId, secret: shopeeSecret }) });
      toast.success("Credenciais da Shopee salvas.");
      setShopeeSecret("");
      carregar();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvandoShopee(false);
    }
  }

  async function alternarChamadaIA(ativa: boolean) {
    try {
      await api(`/configuracoes/chamada-ia/${ativa ? "ativar" : "desativar"}`, { method: "POST" });
      setChamadaIAAtiva(ativa);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }

  async function salvarConfigGeral() {
    setSalvandoConfig(true);
    try {
      await api("/configuracoes", {
        method: "PUT",
        body: JSON.stringify({ descontoMinimo: Number(descontoMinimo), linkCupomFixo }),
      });
      toast.success("Configuração salva.");
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvandoConfig(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-xl font-bold tracking-tight">Config. Afiliados</h2>

      <div
        className={`mb-3.5 flex flex-wrap items-center justify-between gap-4 rounded-md border-l-4 bg-card p-4 shadow-sm ${chromeConectado ? "border-l-success" : "border-l-text-faint"}`}
      >
        <div>
          <h3 className="font-semibold">Chrome (gerador de link ML)</h3>
          <p className="text-sm text-muted-foreground">
            {chromeConectado
              ? "Janela logada aberta."
              : "Não conectado — clique em Abrir Chrome e faça login manualmente (Google bloqueia login automatizado)."}
          </p>
        </div>
        <Button onClick={abrirChrome} disabled={abrindoChrome}>
          <ExternalLink className="h-4 w-4" />
          Abrir Chrome
        </Button>
      </div>

      <div
        className={`mb-6 flex flex-col gap-3.5 rounded-md border-l-4 bg-card p-4 shadow-sm ${shopeeConfigurado ? "border-l-success" : "border-l-text-faint"}`}
      >
        <div>
          <h3 className="font-semibold">
            Shopee (API de afiliados)
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {shopeeConfigurado ? `Configurada — App ID ${shopeeAppId}` : "Não configurada"}
            </span>
          </h3>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shopee-appid">App ID</Label>
            <Input id="shopee-appid" className="w-44" value={shopeeAppId} onChange={(e) => setShopeeAppId(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shopee-secret">Secret</Label>
            <Input
              id="shopee-secret"
              type="password"
              className="w-72"
              placeholder={shopeeConfigurado ? "Deixe em branco pra manter o atual" : "Secret"}
              value={shopeeSecret}
              onChange={(e) => setShopeeSecret(e.target.value)}
            />
          </div>
          <Button onClick={salvarShopee} disabled={salvandoShopee || !shopeeAppId}>
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>
      </div>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configurações gerais</h3>

      <div
        className={`mb-3.5 flex flex-wrap items-center justify-between gap-4 rounded-md border-l-4 bg-card p-4 shadow-sm ${chamadaIAAtiva ? "border-l-success" : "border-l-text-faint"}`}
      >
        <div>
          <h3 className="flex items-center gap-1.5 font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            Chamada por IA (frase de efeito nos produtos)
          </h3>
          <p className="text-sm text-muted-foreground">
            {chamadaIAAtiva
              ? "Ativada — disparo (manual ou automático) gera a chamada via Ollama quando o produto não tiver uma."
              : 'Desativada — disparo segue sem chamada (o botão "Gerar com IA" na aba Produtos continua funcionando normalmente).'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Switch checked={chamadaIAAtiva} onCheckedChange={alternarChamadaIA} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desconto-minimo">Desconto mínimo real (%) pra capturar um produto</Label>
          <Input
            id="desconto-minimo"
            type="number"
            className="w-32"
            min={0}
            max={100}
            value={descontoMinimo}
            onChange={(e) => setDescontoMinimo(e.target.value)}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="link-cupom-fixo">Link fixo dos cupons repassados (lista de recomendações do ML)</Label>
          <Input
            id="link-cupom-fixo"
            placeholder="https://meli.la/xxxxxxx"
            value={linkCupomFixo}
            onChange={(e) => setLinkCupomFixo(e.target.value)}
          />
        </div>
        <Button onClick={salvarConfigGeral} disabled={salvandoConfig}>
          <Save className="h-4 w-4" />
          Salvar
        </Button>
      </div>
    </div>
  );
}
