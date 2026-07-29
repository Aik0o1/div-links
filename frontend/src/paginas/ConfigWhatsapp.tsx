import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { QrCode, List, Copy } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface StatusWhatsapp {
  conectado: boolean;
  existe: boolean;
  estado: string | null;
}

interface GrupoWhatsapp {
  jid: string;
  nome: string;
}

export default function ConfigWhatsapp() {
  const [status, setStatus] = useState<StatusWhatsapp | null>(null);
  const [qrAberto, setQrAberto] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoWhatsapp[] | null>(null);

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

  useEffect(() => {
    carregarStatus();
  }, [carregarStatus]);

  async function buscarQr() {
    try {
      const qr = await api<{ base64: string | null }>("/whatsapp/qrcode");
      setQrBase64(qr.base64);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }

  useEffect(() => {
    if (!qrAberto) return;
    buscarQr();
    const renovar = setInterval(buscarQr, 25000);
    const poll = setInterval(async () => {
      const s = await carregarStatus();
      if (s?.conectado) setQrAberto(false);
    }, 3000);
    return () => {
      clearInterval(renovar);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrAberto]);

  async function carregarGrupos() {
    if (grupos) {
      setGrupos(null);
      return;
    }
    try {
      const g = await api<GrupoWhatsapp[]>("/whatsapp/grupos");
      setGrupos(g);
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    }
  }

  function copiarJid(jid: string) {
    navigator.clipboard.writeText(jid);
    toast.success("JID copiado.");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-xl font-bold tracking-tight">Config. WhatsApp</h2>

      {status && (
        <div
          className={`mb-3.5 flex flex-wrap items-center justify-between gap-4 rounded-md border-l-4 bg-card p-4 shadow-sm ${status.conectado ? "border-l-success" : "border-l-text-faint"}`}
        >
          <div>
            <h3 className="font-semibold">WhatsApp (Evolution API)</h3>
            <p className="text-sm text-muted-foreground">
              {status.conectado
                ? "Conectado."
                : status.existe
                  ? `Instância criada, mas desconectada (estado: ${status.estado ?? "desconhecido"}).`
                  : "Instância ainda não criada — clique em Conectar pra gerar o QR code."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setQrAberto(true)}>
              <QrCode className="h-4 w-4" />
              {status.conectado ? "Reconectar" : "Conectar"}
            </Button>
            <Button variant="outline" onClick={carregarGrupos}>
              <List className="h-4 w-4" />
              Ver grupos
            </Button>
          </div>
        </div>
      )}

      {grupos && (
        <div className="rounded-md border bg-card p-3.5 shadow-sm">
          {grupos.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Nenhum grupo encontrado (conecte o WhatsApp e certifique-se de que ele já participa de algum grupo).
            </p>
          ) : (
            grupos.map((g) => (
              <div key={g.jid} className="flex items-center justify-between gap-2 border-t py-2 first:border-t-0">
                <span className="text-sm">
                  {g.nome} — <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{g.jid}</code>
                </span>
                <Button variant="outline" size="sm" onClick={() => copiarJid(g.jid)}>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar JID
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={qrAberto} onOpenChange={setQrAberto}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Escaneie com o WhatsApp</DialogTitle>
            <DialogDescription>No celular: WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho.</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[280px] items-center justify-center">
            {qrBase64 ? (
              <img src={qrBase64} alt="QR code do WhatsApp" className="h-64 w-64 rounded-md border bg-white p-2" />
            ) : (
              <p className="text-sm text-muted-foreground">Já conectado, ou QR indisponível no momento.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
