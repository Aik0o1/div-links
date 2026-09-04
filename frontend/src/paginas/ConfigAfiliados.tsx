import { useEffect, useState, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { Save, ExternalLink, Cookie as CookieIcon, CheckCircle2, Link as LinkIcon } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/TopBar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import logoML from "@/assets/logoML.webp";
import logoShopee from "@/assets/logoShopee.png";

// Cor de marca de cada marketplace — uma faixa fina no topo do card, não o
// resto da paleta (que continua neutra) — é a mesma ideia de usar a cor
// real do WhatsApp/Telegram nos badges de plataforma em Canais.
const COR_ML = "#2D3277";
const COR_SHOPEE = "#EE4D2D";

/** Círculo numerado — usado nos passos dos guias (Mercado Livre, etc.). */
function NumeroPasso({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
      {children}
    </span>
  );
}

function BadgeStatus({ ok, textoOk, textoFalta }: { ok: boolean; textoOk: string; textoFalta: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        ok ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-success" : "bg-muted-foreground/40")} />
      {ok ? textoOk : textoFalta}
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
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="h-1.5" style={{ background: COR_ML }} />
          <div className="flex flex-1 flex-col p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-white p-2">
                <img src={logoML} alt="Mercado Livre" className="h-full w-full object-contain" />
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">Mercado Livre</h3>
                <BadgeStatus ok={meliCookieConfigurado} textoOk="Conectado" textoFalta="Não conectado" />
              </div>
            </div>
            <p className="mb-5 flex-1 text-sm text-muted-foreground">
              {meliCookieConfigurado
                ? "Os links de afiliado são gerados automaticamente a partir da sua tag e do cookie de sessão."
                : "Sem isso, nenhum produto do Mercado Livre pode ser capturado nem transformado em link de afiliado."}
            </p>
            <Button className="w-full" onClick={abrirGuiaMeli}>
              {meliCookieConfigurado ? "Reconectar" : "Conectar"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="h-1.5" style={{ background: COR_SHOPEE }} />
          <div className="flex flex-1 flex-col p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-white p-1.5">
                <img src={logoShopee} alt="Shopee" className="h-full w-full object-contain" />
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="font-bold text-foreground">Shopee</h3>
                <BadgeStatus
                  ok={shopeeConfigurado}
                  textoOk={`Configurada — App ID ${shopeeAppId}`}
                  textoFalta="Não configurada"
                />
              </div>
            </div>
            <a
              href="https://open.shopee.com/"
              target="_blank"
              rel="noreferrer"
              className="mb-3 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Abrir painel de desenvolvedor da Shopee
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
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
            <Button className="mt-4 w-full" onClick={salvarShopee} disabled={salvandoShopee || !shopeeAppId}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
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

      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LinkIcon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-bold text-foreground">Links fixos de cupom</h3>
            <p className="text-sm text-muted-foreground">
              Usados quando um cupom repassado de um grupo monitorado não tem link de produto próprio pra apontar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-cupom-fixo">Link fixo do Mercado Livre</Label>
            <Input
              id="link-cupom-fixo"
              placeholder="https://meli.la/xxxxxxx"
              value={linkCupomFixo}
              onChange={(e) => setLinkCupomFixo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ex.: o link de uma lista de recomendações sua — vai na legenda dos cupons do ML sem link próprio.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link-cupom-shopee-fixo">Link fixo da Shopee</Label>
            <Input
              id="link-cupom-shopee-fixo"
              placeholder="https://s.shopee.com.br/xxxxxxx"
              value={linkCupomShopeeFixo}
              onChange={(e) => setLinkCupomShopeeFixo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usado em cupom da Shopee de grupo monitorado quando o post não traz um link de produto pra gerar o de
              afiliado.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={salvarConfigGeral} disabled={salvandoConfig}>
            <Save className="h-4 w-4" />
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
