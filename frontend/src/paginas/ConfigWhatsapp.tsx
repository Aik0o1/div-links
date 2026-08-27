import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { QrCode, Search, Copy, Check, Info, Users, CheckCircle2 } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/TopBar";

interface StatusWhatsapp {
  conectado: boolean;
  existe: boolean;
  estado: string | null;
}

interface GrupoWhatsapp {
  jid: string;
  nome: string;
}

const PASSOS = [
  "Abra o WhatsApp no seu celular",
  "Toque em Mais opções (ou Configurações)",
  "Toque em Aparelhos conectados",
  "Aponte a câmera pra esta tela",
];

export default function ConfigWhatsapp() {
  const [status, setStatus] = useState<StatusWhatsapp | null>(null);
  const [conectando, setConectando] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoWhatsapp[]>([]);
  const [busca, setBusca] = useState("");
  const [jidCopiado, setJidCopiado] = useState<string | null>(null);

  const carregarStatus = useCallback(async () => {
    try {
      const s = await api<{ whatsapp: StatusWhatsapp }>("/status");
      setStatus(s.whatsapp);
      return s.whatsapp;
    } catch (err) {
      toast.error(mensagemAmigavel(err));
      return null;
    }
  }, []);

  const carregarGrupos = useCallback(async () => {
    try {
      const g = await api<GrupoWhatsapp[]>("/whatsapp/grupos");
      setGrupos(g);
    } catch {
      // instância ainda sem grupo/sem conexão — mantém lista vazia, sem toast
    }
  }, []);

  useEffect(() => {
    carregarStatus().then((s) => {
      if (s?.conectado) carregarGrupos();
      else setConectando(true);
    });
  }, [carregarStatus, carregarGrupos]);

  async function buscarQr() {
    try {
      const qr = await api<{ base64: string | null }>("/whatsapp/qrcode");
      setQrBase64(qr.base64);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }

  useEffect(() => {
    if (!conectando) return;
    buscarQr();
    const renovar = setInterval(buscarQr, 25000);
    const poll = setInterval(async () => {
      const s = await carregarStatus();
      if (s?.conectado) {
        setConectando(false);
        carregarGrupos();
      }
    }, 3000);
    return () => {
      clearInterval(renovar);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectando]);

  function copiarJid(jid: string) {
    navigator.clipboard.writeText(jid);
    toast.success("JID copiado.");
    setJidCopiado(jid);
    setTimeout(() => setJidCopiado((atual) => (atual === jid ? null : atual)), 2000);
  }

  const gruposFiltrados = grupos.filter((g) => g.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div>
      <PageHeader titulo="Config. WhatsApp" subtitulo="Gerencie a conexão da API e os grupos que ela participa." />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <QrCode className="h-4 w-4" />
              </span>
              <h3 className="text-lg font-bold text-foreground">Conexão via QR Code</h3>
            </div>

            <div className="mx-auto mb-4 flex aspect-square w-full max-w-[220px] items-center justify-center rounded-lg border border-border bg-muted">
              {status?.conectado ? (
                <CheckCircle2 className="h-16 w-16 text-success" />
              ) : qrBase64 ? (
                <img src={qrBase64} alt="QR code do WhatsApp" className="h-full w-full rounded-lg bg-white p-2" />
              ) : (
                <QrCode className="h-16 w-16 text-text-faint" />
              )}
            </div>

            <div className="mb-4 flex justify-center">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
                  status?.conectado ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", status?.conectado ? "bg-success" : "animate-pulse bg-warning")} />
                {status?.conectado ? "Conectado" : "Aguardando leitura"}
              </span>
            </div>

            {status?.conectado ? (
              <Button variant="outline" className="w-full" onClick={() => setConectando(true)}>
                <QrCode className="h-4 w-4" />
                Reconectar (novo aparelho)
              </Button>
            ) : (
              <ol className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                {PASSOS.map((passo, i) => (
                  <li key={i}>
                    {i + 1}. {passo}
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Dica de monitoramento</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              A instância fica escutando as mensagens dos grupos em tempo real. Se a conexão cair, o bot para de
              capturar cupons e produtos até você escanear o QR de novo.
            </p>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
            <div>
              <h3 className="text-lg font-bold text-foreground">Seus grupos</h3>
              <p className="text-sm text-muted-foreground">Grupos ativos que esse número participa.</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar grupo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 w-56 pl-8 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {!status?.conectado ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Conecte o WhatsApp pra ver os grupos.</p>
            ) : gruposFiltrados.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {grupos.length === 0 ? "Nenhum grupo encontrado ainda." : "Nenhum grupo bate com essa busca."}
              </p>
            ) : (
              gruposFiltrados.map((g) => (
                <div key={g.jid} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Users className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{g.nome}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{g.jid}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => copiarJid(g.jid)}>
                    {jidCopiado === g.jid ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {jidCopiado === g.jid ? "Copiado" : "Copiar JID"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
