import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useDisparoAutomatico } from "@/lib/disparoAutomatico";
import Dashboard from "@/paginas/Dashboard";
import Canais from "@/paginas/Canais";
import ConfigAfiliados from "@/paginas/ConfigAfiliados";
import ConfigWhatsapp from "@/paginas/ConfigWhatsapp";
import ConfigTelegram from "@/paginas/ConfigTelegram";
import Produtos from "@/paginas/Produtos";
import Cupons from "@/paginas/Cupons";
import Assinatura from "@/paginas/Assinatura";
import Login from "@/paginas/Login";
import Signup from "@/paginas/Signup";
import { useSessao } from "@/lib/auth";
import { useAssinatura } from "@/lib/assinatura";
import { LogOut } from "lucide-react";

export type Aba =
  | "dashboard"
  | "afiliados"
  | "whatsapp"
  | "telegram"
  | "canais"
  | "produtos"
  | "cupons"
  | "assinatura";

export default function App() {
  const [aba, setAba] = useState<Aba>("dashboard");
  const { usuario, carregando: carregandoSessao, definirUsuario, logout } = useSessao();
  const { assinatura, carregando: carregandoAssinatura, recarregar: recarregarAssinatura } = useAssinatura(!!usuario);
  const [telaCadastro, setTelaCadastro] = useState(false);
  const podeUsarPainel = !!usuario && !carregandoAssinatura && (!assinatura || assinatura.acessoLiberado);
  const disparo = useDisparoAutomatico(podeUsarPainel);

  if (carregandoSessao || (usuario && carregandoAssinatura)) {
    return <div className="flex min-h-screen items-center justify-center bg-background" />;
  }

  if (!usuario) {
    return telaCadastro ? (
      <Signup aoCadastrar={definirUsuario} irParaLogin={() => setTelaCadastro(false)} />
    ) : (
      <Login aoLogar={definirUsuario} irParaCadastro={() => setTelaCadastro(true)} />
    );
  }

  // `assinatura` só vem `null` num erro de rede genuíno (a rota nunca fica
  // atrás do bloqueio, ver middleware/assinatura.ts) — nesse caso deixa
  // passar pro painel normal em vez de travar o usuário numa tela em branco.
  if (assinatura && !assinatura.acessoLiberado) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="flex items-center justify-between border-b px-4 py-3 sm:px-8">
          <span className="text-sm font-semibold">PromoFlow</span>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </header>
        <main className="flex-1 p-4 sm:p-8">
          <p className="mx-auto mb-4 max-w-3xl text-sm text-muted-foreground">
            Sua assinatura não está ativa — escolha um plano pra continuar usando o painel.
          </p>
          <Assinatura onAtualizar={recarregarAssinatura} />
        </main>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <Sidebar abaAtiva={aba} onMudarAba={setAba} usuario={usuario} onSair={logout} />
      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <TopBar aba={aba} disparo={disparo} />
        {aba === "dashboard" && <Dashboard onNavegar={setAba} disparo={disparo} />}
        {aba === "afiliados" && <ConfigAfiliados />}
        {aba === "whatsapp" && <ConfigWhatsapp />}
        {aba === "telegram" && <ConfigTelegram />}
        {aba === "canais" && <Canais />}
        {aba === "produtos" && <Produtos />}
        {aba === "cupons" && <Cupons />}
        {aba === "assinatura" && <Assinatura />}
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
