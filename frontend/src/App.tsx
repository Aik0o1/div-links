import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/Sidebar";
import Dashboard from "@/paginas/Dashboard";
import Canais from "@/paginas/Canais";
import ConfigAfiliados from "@/paginas/ConfigAfiliados";
import ConfigWhatsapp from "@/paginas/ConfigWhatsapp";
import ConfigTelegram from "@/paginas/ConfigTelegram";
import GruposMonitorados from "@/paginas/GruposMonitorados";
import Produtos from "@/paginas/Produtos";
import Cupons from "@/paginas/Cupons";
import Login from "@/paginas/Login";
import Signup from "@/paginas/Signup";
import { useSessao } from "@/lib/auth";

export type Aba =
  | "dashboard"
  | "afiliados"
  | "whatsapp"
  | "telegram"
  | "canais"
  | "monitorados"
  | "produtos"
  | "cupons";

export default function App() {
  const [aba, setAba] = useState<Aba>("dashboard");
  const { usuario, carregando, definirUsuario, logout } = useSessao();
  const [telaCadastro, setTelaCadastro] = useState(false);

  if (carregando) {
    return <div className="flex min-h-screen items-center justify-center bg-background" />;
  }

  if (!usuario) {
    return telaCadastro ? (
      <Signup aoCadastrar={definirUsuario} irParaLogin={() => setTelaCadastro(false)} />
    ) : (
      <Login aoLogar={definirUsuario} irParaCadastro={() => setTelaCadastro(true)} />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <Sidebar abaAtiva={aba} onMudarAba={setAba} usuario={usuario} onSair={logout} />
      <main className="min-w-0 flex-1 p-4 sm:p-8">
        {aba === "dashboard" && <Dashboard onNavegar={setAba} />}
        {aba === "afiliados" && <ConfigAfiliados />}
        {aba === "whatsapp" && <ConfigWhatsapp />}
        {aba === "telegram" && <ConfigTelegram />}
        {aba === "canais" && <Canais />}
        {aba === "monitorados" && <GruposMonitorados />}
        {aba === "produtos" && <Produtos />}
        {aba === "cupons" && <Cupons />}
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
