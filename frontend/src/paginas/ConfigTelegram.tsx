import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { LogIn, Send, Radio } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/TopBar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface StatusTelegramListener {
  autenticado: boolean;
  gruposMonitorados: { id: string; nicho: string }[];
}

type Etapa = "telefone" | "codigo" | "senha";

export default function ConfigTelegram() {
  const [status, setStatus] = useState<StatusTelegramListener | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("telefone");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregarStatus = useCallback(async () => {
    try {
      const s = await api<{ telegramListener: StatusTelegramListener }>("/status");
      setStatus(s.telegramListener);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }, []);

  useEffect(() => {
    carregarStatus();
  }, [carregarStatus]);

  function abrirModal() {
    setEtapa("telefone");
    setTelefone("");
    setCodigo("");
    setSenha("");
    setErro("");
    setModalAberto(true);
  }

  async function enviarTelefone() {
    setErro("");
    setEnviando(true);
    try {
      await api("/telegram-listener/telefone", { method: "POST", body: JSON.stringify({ telefone }) });
      setEtapa("codigo");
    } catch (err) {
      setErro(mensagemAmigavel(err));
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo() {
    setErro("");
    setEnviando(true);
    try {
      const { precisaSenha } = await api<{ precisaSenha: boolean }>("/telegram-listener/codigo", {
        method: "POST",
        body: JSON.stringify({ codigo }),
      });
      if (precisaSenha) {
        setEtapa("senha");
      } else {
        setModalAberto(false);
        carregarStatus();
      }
    } catch (err) {
      setErro(mensagemAmigavel(err));
    } finally {
      setEnviando(false);
    }
  }

  async function enviarSenha() {
    setErro("");
    setEnviando(true);
    try {
      await api("/telegram-listener/senha", { method: "POST", body: JSON.stringify({ senha }) });
      setModalAberto(false);
      carregarStatus();
    } catch (err) {
      setErro(mensagemAmigavel(err));
    } finally {
      setEnviando(false);
    }
  }

  const numGrupos = status?.gruposMonitorados.length ?? 0;
  const ativo = !!status?.autenticado && numGrupos > 0;

  return (
    <div>
      <PageHeader titulo="Config. Telegram" subtitulo="Conecte a conta que vai monitorar grupos de cupons e produtos." />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft lg:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Send className="h-4 w-4" />
            </span>
            <h3 className="text-lg font-bold text-foreground">Conta monitora</h3>
          </div>

          <div className="mb-4 flex justify-center">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
                ativo ? "bg-success/10 text-success" : status?.autenticado ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  ativo ? "animate-pulse bg-success" : status?.autenticado ? "bg-warning" : "bg-text-faint",
                )}
              />
              {ativo ? "Monitorando" : status?.autenticado ? "Conectado, sem grupos" : "Não conectado"}
            </span>
          </div>

          <p className="mb-4 text-center text-sm text-muted-foreground">
            {status?.autenticado
              ? "Login com o número que fica escutando os grupos já foi feito."
              : "Faça login com o número que vai ficar só monitorando o grupo de cupons (não precisa ser o do bot)."}
          </p>

          <Button className="w-full" onClick={abrirModal}>
            <LogIn className="h-4 w-4" />
            {status?.autenticado ? "Reconectar" : "Conectar"}
          </Button>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft lg:col-span-2">
          <div className="border-b border-border p-5">
            <h3 className="text-lg font-bold text-foreground">Grupos monitorados</h3>
            <p className="text-sm text-muted-foreground">
              Cupons e produtos novos capturados aqui são repassados automaticamente pros canais ativos.
            </p>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {!status?.autenticado ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Conecte uma conta pra monitorar grupos.</p>
            ) : numGrupos === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Nenhum grupo selecionado ainda — escolha os grupos ao criar ou editar um canal, em Canais/Grupos.
              </p>
            ) : (
              status!.gruposMonitorados.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Radio className="h-4 w-4" />
                    </span>
                    <p className="truncate font-mono text-xs text-muted-foreground">{g.id}</p>
                  </div>
                  <Badge variant="info" className="flex-shrink-0 capitalize">
                    {g.nicho}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectar conta do Telegram</DialogTitle>
            <DialogDescription>
              Login com o número que vai ficar só monitorando o grupo de cupons (não precisa ser o do bot).
            </DialogDescription>
          </DialogHeader>

          {etapa === "telefone" && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                enviarTelefone();
              }}
            >
              <Input placeholder="+55 11 91234-5678" value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
              <Button type="submit" disabled={enviando}>
                Enviar código
              </Button>
            </form>
          )}

          {etapa === "codigo" && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                enviarCodigo();
              }}
            >
              <Input placeholder="Código recebido no Telegram" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
              <Button type="submit" disabled={enviando}>
                Confirmar código
              </Button>
            </form>
          )}

          {etapa === "senha" && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                enviarSenha();
              }}
            >
              <Input
                type="password"
                placeholder="Senha de verificação em duas etapas"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <Button type="submit" disabled={enviando}>
                Confirmar senha
              </Button>
            </form>
          )}

          {erro && <p className="min-h-4 text-sm text-destructive">{erro}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
