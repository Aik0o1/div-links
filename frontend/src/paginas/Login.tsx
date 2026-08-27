import { useState, type FormEvent } from "react";
import { LogIn, Link2 } from "lucide-react";
import { api, mensagemAmigavel } from "@/lib/api";
import type { UsuarioSessao } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login({
  aoLogar,
  irParaCadastro,
}: {
  aoLogar: (usuario: UsuarioSessao) => void;
  irParaCadastro: () => void;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function aoSubmeter(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    try {
      const usuario = await api<UsuarioSessao>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
      });
      aoLogar(usuario);
    } catch (err) {
      setErro(mensagemAmigavel(err));
    } finally {
      setEntrando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary shadow-soft">
            <Link2 className="h-5 w-5 text-primary-foreground" />
          </span>
          <CardTitle className="mt-2 text-xl">PromoFlow</CardTitle>
          <CardDescription>Entre com a sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={aoSubmeter}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-senha">Senha</Label>
              <Input
                id="login-senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" disabled={entrando} className="mt-1">
              <LogIn className="h-4 w-4" />
              Entrar
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <button type="button" onClick={irParaCadastro} className="font-medium text-primary hover:underline">
              Criar conta
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
