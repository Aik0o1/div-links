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

export type Aba =
  | "dashboard"
  | "afiliados"
  | "whatsapp"
  | "telegram"
  | "canais"
  | "monitorados"
  | "produtos";

export default function App() {
  const [aba, setAba] = useState<Aba>("dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <Sidebar abaAtiva={aba} onMudarAba={setAba} />
      <main className="min-w-0 flex-1 p-4 sm:p-8">
        {aba === "dashboard" && <Dashboard onNavegar={setAba} />}
        {aba === "afiliados" && <ConfigAfiliados />}
        {aba === "whatsapp" && <ConfigWhatsapp />}
        {aba === "telegram" && <ConfigTelegram />}
        {aba === "canais" && <Canais />}
        {aba === "monitorados" && <GruposMonitorados />}
        {aba === "produtos" && <Produtos />}
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
