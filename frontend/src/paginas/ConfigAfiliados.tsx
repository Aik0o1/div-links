import { useEffect, useState, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { Save, Store, ShoppingBag, ExternalLink, Cookie as CookieIcon, CheckCircle2 } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/TopBar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Círculo numerado — usado nos passos dos guias (Mercado Livre, etc.). */
function NumeroPasso({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {children}
    </span>
  );
}

export default function ConfigAfiliados() {
  const [meliTag, setMeliTag] = useState("");
  const [meliCookie, setMeliCookie] = useState("");
  const [meliCookieConfigurado, setMeliCookieConfigurado] = useState(false);
  const [salvandoMeli, setSalvandoMeli] = useState(false);
  const [guiaMeliAberto, setGuiaMeliAberto] = useState(false);

  const [shopeeAppId, setShopeeAppId] = useState("");
  const [shopeeSecret, setShopeeSecret] = useState("");
  const [shopeeConfigurado, setShopeeConfigurado] = useState(false);
  const [salvandoShopee, setSalvandoShopee] = useState(false);

  const [linkCupomFixo, setLinkCupomFixo] = useState("");
  const [linkCupomShopeeFixo, setLinkCupomShopeeFixo] = useState("");
  const [salvandoConfig, setSalvandoConfig] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [meli, shopee, config] = await Promise.all([
        api<{ tag: string; cookieConfigurado: boolean }>("/configuracoes/mercado-livre"),
        api<{ appId: string; configurado: boolean }>("/configuracoes/shopee"),
        api<{
          linkCupomFixo: string | null;
          linkCupomShopeeFixo: string | null;
        }>("/configuracoes"),
      ]);
      setMeliTag(meli.tag);
      setMeliCookieConfigurado(meli.cookieConfigurado);
      setShopeeAppId(shopee.appId);
      setShopeeConfigurado(shopee.configurado);
      setLinkCupomFixo(config.linkCupomFixo ?? "");
      setLinkCupomShopeeFixo(config.linkCupomShopeeFixo ?? "");
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirGuiaMeli() {
    setMeliCookie("");
    setGuiaMeliAberto(true);
  }

  async function salvarMeli() {
    setSalvandoMeli(true);
    try {
      await api("/configuracoes/mercado-livre", {
        method: "PUT",
        body: JSON.stringify({ tag: meliTag, cookie: meliCookie }),
      });
      toast.success("Mercado Livre conectado com sucesso!");
      setMeliCookie("");
      setGuiaMeliAberto(false);
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

  async function salvarConfigGeral() {
    setSalvandoConfig(true);
    try {
      await api("/configuracoes", {
        method: "PUT",
        body: JSON.stringify({ linkCupomFixo, linkCupomShopeeFixo }),
      });
      toast.success("Configuração salva.");
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvandoConfig(false);
    }
  }

  return (
    <div>
      <PageHeader titulo="Config. Afiliados" subtitulo="Credenciais do Mercado Livre e da Shopee, e regras gerais de captura." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
                meliCookieConfigurado ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              <Store className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold text-foreground">Mercado Livre</h3>
              <p className="text-xs text-muted-foreground">{meliCookieConfigurado ? "Conectado" : "Não conectado"}</p>
            </div>
          </div>
          <p className="mb-4 flex-1 text-sm text-muted-foreground">
            {meliCookieConfigurado
              ? "Os links de afiliado são gerados automaticamente."
              : "Sem isso, nenhum produto do Mercado Livre pode ser divulgado."}
          </p>
          <Button className="w-full" onClick={abrirGuiaMeli}>
            {meliCookieConfigurado ? "Reconectar" : "Conectar"}
          </Button>
        </div>

        <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <span
              className={cn(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full",
                shopeeConfigurado ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold text-foreground">Shopee</h3>
              <p className="text-xs text-muted-foreground">
                {shopeeConfigurado ? `Configurada — App ID ${shopeeAppId}` : "Não configurada"}
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shopee-appid">App ID</Label>
              <Input id="shopee-appid" value={shopeeAppId} onChange={(e) => setShopeeAppId(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shopee-secret">Secret</Label>
              <Input
                id="shopee-secret"
                type="password"
                placeholder={shopeeConfigurado ? "Deixe em branco pra manter o atual" : "Secret"}
                value={shopeeSecret}
                onChange={(e) => setShopeeSecret(e.target.value)}
              />
            </div>
          </div>
          <Button className="mt-3 w-full" onClick={salvarShopee} disabled={salvandoShopee || !shopeeAppId}>
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>
      </div>

      <Dialog open={guiaMeliAberto} onOpenChange={setGuiaMeliAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Conectar o Mercado Livre</DialogTitle>
            <DialogDescription>
              Duas informações da sua conta de afiliado. Leva uns 2 minutinhos — e você só precisa repetir o passo 2
              de vez em quando (o passo 1 é só uma vez).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5">
            <div className="flex gap-3">
              <NumeroPasso>1</NumeroPasso>
              <div className="flex flex-1 flex-col gap-2">
                <p className="text-sm font-medium">Copie a sua tag de afiliado</p>
                <p className="text-sm text-muted-foreground">
                  É o código que identifica você no Mercado Livre — nunca muda. Aparece em qualquer link que você já
                  gerou no painel de afiliados.
                </p>
                <a
                  href="https://www.mercadolivre.com.br/l/afiliados-home"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Abrir painel de afiliados do Mercado Livre
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Input
                  placeholder="Cole sua tag aqui (ex.: seuusuario20220908145641)"
                  value={meliTag}
                  onChange={(e) => setMeliTag(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <NumeroPasso>2</NumeroPasso>
              <div className="flex flex-1 flex-col gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <CookieIcon className="h-3.5 w-3.5 text-primary" />
                  Cole o cookie de sessão
                </p>
                <p className="text-sm text-muted-foreground">
                  Essa parte é meio técnica, mas é só seguir o passo a passo — depois de pronta uma vez, só precisa
                  repetir daqui a algumas semanas, quando o sistema avisar que parou de funcionar.
                </p>
                <ol className="flex flex-col gap-1.5 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <li>
                    <b className="text-foreground">a.</b> Abra o mercadolivre.com.br numa aba, logado com a sua conta
                    de afiliado.
                  </li>
                  <li>
                    <b className="text-foreground">b.</b> Aperte a tecla <code className="rounded bg-muted px-1 py-0.5">F12</code>{" "}
                    — abre um painel técnico do navegador.
                  </li>
                  <li>
                    <b className="text-foreground">c.</b> Clique na aba <b className="text-foreground">"Network"</b> (ou "Rede") lá em cima.
                  </li>
                  <li>
                    <b className="text-foreground">d.</b> Aperte <code className="rounded bg-muted px-1 py-0.5">F5</code> pra recarregar a página.
                  </li>
                  <li>
                    <b className="text-foreground">e.</b> Clique em qualquer uma das linhas que apareceram na lista.
                  </li>
                  <li>
                    <b className="text-foreground">f.</b> Ache <b className="text-foreground">"Request Headers"</b> e a linha que começa com{" "}
                    <code className="rounded bg-muted px-1 py-0.5">cookie:</code>
                  </li>
                  <li>
                    <b className="text-foreground">g.</b> Copie o valor inteiro (é bem comprido, tudo bem) e cole abaixo.
                  </li>
                </ol>
                <Textarea
                  rows={3}
                  className="font-mono text-xs"
                  placeholder={meliCookieConfigurado ? "Já configurado — cole aqui só se for trocar" : "cookie1=valor1; cookie2=valor2; ..."}
                  value={meliCookie}
                  onChange={(e) => setMeliCookie(e.target.value)}
                />
              </div>
            </div>

            {meliCookieConfigurado && (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                Já tem um cookie salvo — só preencha de novo se quiser trocar.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={salvarMeli} disabled={salvandoMeli || !meliTag}>
              <Save className="h-4 w-4" />
              Salvar e conectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <h3 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configurações gerais</h3>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-6 shadow-soft">
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
