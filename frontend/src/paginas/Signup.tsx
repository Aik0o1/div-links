import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { UserPlus, Link2, Zap, ShoppingBag, MessageCircle } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import type { UsuarioSessao } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/GoogleButton";

const ERROS_GOOGLE: Record<string, string> = {
  google_state_invalido: "Não deu pra confirmar a autenticação com o Google — tenta de novo.",
  google_email_nao_verificado: "Sua conta Google precisa ter o email verificado pra entrar por aqui.",
  conta_inativa: "Essa conta está inativa.",
  google_falhou: "Não deu pra entrar com o Google agora — tenta de novo em instantes.",
};

const DESTAQUES = [
  { icone: ShoppingBag, texto: "Captura ofertas do Mercado Livre e Shopee automaticamente" },
  { icone: MessageCircle, texto: "Dispara pros seus grupos de WhatsApp e Telegram" },
  { icone: Zap, texto: "Comece grátis, sem cartão de crédito" },
];

export default function Signup({
  aoCadastrar,
  irParaLogin,
}: {
  aoCadastrar: (usuario: UsuarioSessao) => void;
  irParaLogin: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [cadastrando, setCadastrando] = useState(false);

  // Volta do redirect do login com Google (ver rotas/auth.ts) — o backend
  // só sabe redirecionar com um código de erro na query, não mostrar toast
  // ele mesmo (não tem pra onde, é um navegador navegando, não um fetch).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codigoErro = params.get("erro");
    if (codigoErro) {
      toast.error(ERROS_GOOGLE[codigoErro] ?? "Não deu pra entrar com o Google agora.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function aoSubmeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setCadastrando(true);
    try {
      const usuario = await api<UsuarioSessao>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, senha, nome: nome || undefined }),
      });
      aoCadastrar(usuario);
    } catch (err) {
      setErro(mensagemAmigavel(err));
    } finally {
      setCadastrando(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Painel de marca — só em telas largas, some no mobile pra não empurrar o formulário pra baixo */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-sidebar p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Link2 className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">PromoFlow</span>
        </div>
        <div className="max-w-sm">
          <h2 className="text-3xl leading-tight font-semibold">
            Divulgação de promoções no piloto automático.
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icone className="h-4 w-4" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">© 2026 PromoFlow</p>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-soft lg:hidden">
              <Link2 className="h-5 w-5 text-primary-foreground" />
            </span>
            <h1 className="mt-3 text-2xl font-semibold lg:mt-0">Crie sua conta</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Grátis pra começar, sem cartão.</p>
          </div>

          <div className="flex flex-col gap-5">
            <GoogleButton />

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              ou cadastre com email
              <div className="h-px flex-1 bg-border" />
            </div>

            <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-nome">Nome (opcional)</Label>
                <Input id="signup-nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-senha">Senha</Label>
                <Input
                  id="signup-senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
              </div>
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <Button type="submit" disabled={cadastrando} className="mt-1">
                <UserPlus className="h-4 w-4" />
                Criar conta
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <button type="button" onClick={irParaLogin} className="font-medium text-primary hover:underline">
              Entrar
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
