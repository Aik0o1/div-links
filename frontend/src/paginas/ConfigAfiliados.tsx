import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Sparkles, Save } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export default function ConfigAfiliados() {
  const [meliTag, setMeliTag] = useState("");
  const [meliCookie, setMeliCookie] = useState("");
  const [meliCookieConfigurado, setMeliCookieConfigurado] = useState(false);
  const [salvandoMeli, setSalvandoMeli] = useState(false);

  const [shopeeAppId, setShopeeAppId] = useState("");
  const [shopeeSecret, setShopeeSecret] = useState("");
  const [shopeeConfigurado, setShopeeConfigurado] = useState(false);
  const [salvandoShopee, setSalvandoShopee] = useState(false);

  const [chamadaIAAtiva, setChamadaIAAtiva] = useState(false);
  const [descontoMinimo, setDescontoMinimo] = useState("0");
  const [linkCupomFixo, setLinkCupomFixo] = useState("");
  const [linkCupomShopeeFixo, setLinkCupomShopeeFixo] = useState("");
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [meli, shopee, config] = await Promise.all([
        api<{ tag: string; cookieConfigurado: boolean }>("/configuracoes/mercado-livre"),
        api<{ appId: string; configurado: boolean }>("/configuracoes/shopee"),
        api<{
          descontoMinimo: number;
          linkCupomFixo: string | null;
          linkCupomShopeeFixo: string | null;
          chamadaIAAtiva: boolean;
        }>("/configuracoes"),
      ]);
      setMeliTag(meli.tag);
      setMeliCookieConfigurado(meli.cookieConfigurado);
      setShopeeAppId(shopee.appId);
      setShopeeConfigurado(shopee.configurado);
      setDescontoMinimo(String(config.descontoMinimo));
      setLinkCupomFixo(config.linkCupomFixo ?? "");
      setLinkCupomShopeeFixo(config.linkCupomShopeeFixo ?? "");
      setChamadaIAAtiva(config.chamadaIAAtiva);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarMeli() {
    setSalvandoMeli(true);
    try {
      await api("/configuracoes/mercado-livre", {
        method: "PUT",
        body: JSON.stringify({ tag: meliTag, cookie: meliCookie }),
      });
      toast.success("Configuração do Mercado Livre salva.");
      setMeliCookie("");
      carregar();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvandoMeli(false);
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
        body: JSON.stringify({ descontoMinimo: Number(descontoMinimo), linkCupomFixo, linkCupomShopeeFixo }),
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
        className={`mb-3.5 flex flex-col gap-3.5 rounded-md border-l-4 bg-card p-4 shadow-sm ${meliCookieConfigurado ? "border-l-success" : "border-l-text-faint"}`}
      >
        <div>
          <h3 className="font-semibold">
            Mercado Livre
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {meliCookieConfigurado ? "Cookie configurado" : "Cookie não configurado"}
            </span>
          </h3>
          <p className="text-sm text-muted-foreground">
            Gera o link de afiliado (e captura produto de grupo monitorado) via HTTP direto, sem precisar de Chrome
            aberto. A tag vem de qualquer link gerado no seu painel de afiliados do ML. O cookie expira periodicamente
            — quando parar de funcionar, pegue um novo: logado no ML, F12 → aba Network → qualquer requisição →
            Request Headers → copie o valor de <code>cookie</code> inteiro.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meli-tag">Tag de afiliado</Label>
          <Input
            id="meli-tag"
            className="w-72"
            placeholder="seuusuario20220908145641"
            value={meliTag}
            onChange={(e) => setMeliTag(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="meli-cookie">Cookie de sessão do Mercado Livre</Label>
          <Textarea
            id="meli-cookie"
            rows={3}
            placeholder={meliCookieConfigurado ? "Deixe em branco pra manter o atual" : "cookie1=valor1; cookie2=valor2; ..."}
            value={meliCookie}
            onChange={(e) => setMeliCookie(e.target.value)}
          />
        </div>
        <div>
          <Button onClick={salvarMeli} disabled={salvandoMeli || !meliTag}>
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>
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
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="link-cupom-shopee-fixo">Link fixo de cupons Shopee (produto de grupo monitorado)</Label>
          <Input
            id="link-cupom-shopee-fixo"
            placeholder="https://s.shopee.com.br/xxxxxxx"
            value={linkCupomShopeeFixo}
            onChange={(e) => setLinkCupomShopeeFixo(e.target.value)}
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
