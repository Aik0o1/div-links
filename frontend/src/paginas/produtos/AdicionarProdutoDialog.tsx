import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Captura avulsa de um produto específico por link (POST
 * /produtos/capturar-manual, ver capturarProdutoManual.ts) — pra quando o
 * usuário já achou a oferta em algum lugar e só quer colocar na fila, sem
 * esperar a captura em massa do nicho pegar ela. Título, imagem e preço
 * original SEMPRE vêm da página real do produto; cupom/chamada/preço "Por:"
 * são opcionais e, quando ausentes, o disparo usa o que a página trouxer
 * (chamada pode ser gerada por IA depois, ver ProdutoCard).
 */
export function AdicionarProdutoDialog({ nicho, onAdicionado }: { nicho: string; onAdicionado: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [url, setUrl] = useState("");
  const [cupom, setCupom] = useState("");
  const [chamada, setChamada] = useState("");
  const [precoPromocional, setPrecoPromocional] = useState("");
  const [salvando, setSalvando] = useState(false);

  function abrir() {
    setUrl("");
    setCupom("");
    setChamada("");
    setPrecoPromocional("");
    setAberto(true);
  }

  async function salvar() {
    if (!url.trim()) {
      toast.error("Cole o link do produto.");
      return;
    }
    setSalvando(true);
    try {
      await api("/produtos/capturar-manual", {
        method: "POST",
        body: JSON.stringify({
          url: url.trim(),
          nicho,
          cupom: cupom.trim() || undefined,
          chamada: chamada.trim() || undefined,
          precoPromocional: precoPromocional.trim() ? Number(precoPromocional) : undefined,
        }),
      });
      toast.success("Produto capturado.");
      setAberto(false);
      onAdicionado();
    } catch (err) {
      toast.error(mensagemAmigavel(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={abrir}>
        <Plus className="h-4 w-4" />
        Adicionar produto
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar produto específico</DialogTitle>
            <DialogDescription>
              Cole seu link de afiliado — título, imagem e preço original vêm direto da página do produto.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-produto-url">Link do produto (seu link de afiliado)</Label>
              <Input
                id="add-produto-url"
                placeholder="https://meli.la/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-produto-cupom">Cupom (opcional)</Label>
              <Input id="add-produto-cupom" value={cupom} onChange={(e) => setCupom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-produto-chamada">Chamada / mensagem impactante (opcional)</Label>
              <Input id="add-produto-chamada" value={chamada} onChange={(e) => setChamada(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-produto-preco">Preço "Por:" (opcional)</Label>
              <Input
                id="add-produto-preco"
                type="number"
                step="0.01"
                placeholder="Deixe em branco pra usar o preço da página"
                value={precoPromocional}
                onChange={(e) => setPrecoPromocional(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Capturando..." : "Capturar produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
