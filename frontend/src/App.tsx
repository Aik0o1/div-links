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
import { LogOut, Link2 } from "lucide-react";

export type Aba =
  | "dashboard"
  | "afiliados"
  | "whatsapp"
  | "telegram"
  | "canais"
  | "produtos"
  | "cupons"
  | "assinatura";

const ABAS_VALIDAS: readonly string[] = [
  "dashboard",
  "afiliados",
  "whatsapp",
  "telegram",
  "canais",
  "produtos",
  "cupons",
  "assinatura",
];
const CHAVE_ABA_SALVA = "promoflow:aba";

/** Lê a última aba visitada — sem isso, dar F5 em qualquer aba sempre
 * voltava pro Dashboard (não tem router, só esse `useState`; a página
 * recarrega do zero e perde tudo que não esteja persistido). */
function lerAbaSalva(): Aba {
  try {
    const salva = localStorage.getItem(CHAVE_ABA_SALVA);
    if (salva && ABAS_VALIDAS.includes(salva)) return salva as Aba;
  } catch {
    // localStorage indisponível (modo privado, etc.) — cai no padrão
  }
  return "dashboard";
}

export default function App() {
  const [aba, setAba] = useState<Aba>(lerAbaSalva);

  function mudarAba(nova: Aba) {
    setAba(nova);
    try {
      localStorage.setItem(CHAVE_ABA_SALVA, nova);
    } catch {
      // localStorage indisponível — só não persiste entre reloads, sem quebrar a navegação
    }
  }
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
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-8">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <Link2 className="h-3.5 w-3.5 text-primary-foreground" />
            </span>
            PromoFlow
          </span>
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
          <p className="mx-auto mb-4 max-w-3xl rounded-lg border-l-4 border-l-warning bg-warning-soft p-3.5 text-sm text-foreground">
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
      <Sidebar abaAtiva={aba} onMudarAba={mudarAba} usuario={usuario} onSair={logout} />
      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <TopBar aba={aba} disparo={disparo} />
        {aba === "dashboard" && <Dashboard onNavegar={mudarAba} disparo={disparo} />}
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
