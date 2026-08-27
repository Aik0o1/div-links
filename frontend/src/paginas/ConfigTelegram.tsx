import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <div className="mx-auto max-w-3xl">
      <PageHeader titulo="Config. Telegram" subtitulo="Conecte a conta que vai monitorar grupos de cupons e produtos." />
      {status && (
        <div
          className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border-l-4 bg-card p-4 shadow-soft ${ativo ? "border-l-success" : "border-l-text-faint"}`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2 w-2 rounded-full ${ativo ? "animate-pulse bg-success" : status.autenticado ? "bg-warning" : "bg-text-faint"}`}
            />
            <div>
              <h3 className="font-semibold text-foreground">Monitor de grupos (Telegram)</h3>
              <p className="text-sm text-muted-foreground">
                {ativo
                  ? `Monitorando ${numGrupos} grupo(s) — cupons e produtos novos são repassados automaticamente pros seus canais ativos.`
                  : status.autenticado
                    ? "Conectado, mas nenhum grupo selecionado ainda — vá em Grupos monitorados."
                    : "Não conectado — clique em Conectar e faça login com o número que vai monitorar os grupos."}
              </p>
            </div>
          </div>
          <Button onClick={abrirModal}>
            <LogIn className="h-4 w-4" />
            {status.autenticado ? "Reconectar" : "Conectar"}
          </Button>
        </div>
      )}

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
