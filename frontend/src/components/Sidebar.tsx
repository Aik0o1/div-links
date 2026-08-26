import {
  LayoutDashboard,
  Link2,
  MessageCircle,
  Send,
  Radio,
  Satellite,
  Package,
  Ticket,
  CreditCard,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Aba } from "@/App";
import type { UsuarioSessao } from "@/lib/auth";

const ITENS: { aba: Aba; label: string; Icon: LucideIcon }[] = [
  { aba: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { aba: "afiliados", label: "Config. Afiliados", Icon: Link2 },
  { aba: "whatsapp", label: "Config. WhatsApp", Icon: MessageCircle },
  { aba: "telegram", label: "Config. Telegram", Icon: Send },
  { aba: "canais", label: "Canais/Grupos", Icon: Radio },
  { aba: "monitorados", label: "Grupos monitorados", Icon: Satellite },
  { aba: "produtos", label: "Produtos", Icon: Package },
  { aba: "cupons", label: "Cupons", Icon: Ticket },
  { aba: "assinatura", label: "Assinatura", Icon: CreditCard },
];

export function Sidebar({
  abaAtiva,
  onMudarAba,
  usuario,
  onSair,
}: {
  abaAtiva: Aba;
  onMudarAba: (a: Aba) => void;
  usuario: UsuarioSessao;
  onSair: () => void;
}) {
  return (
    <aside className="sticky top-0 z-20 flex w-full flex-shrink-0 flex-col gap-4 bg-gradient-to-b from-header to-header-alt p-4 text-white lg:h-screen lg:w-60 lg:gap-6 lg:overflow-y-auto lg:p-5">
      <div className="flex items-center gap-3 px-1.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-primary to-[#b3a6ff] shadow-[0_4px_14px_rgba(106,92,255,0.5)]">
          <Link2 className="h-4.5 w-4.5 text-white" />
        </span>
        <div>
          <h1 className="text-[17px] font-bold leading-tight tracking-tight">PromoFlow</h1>
          <p className="text-xs text-[#a8abc0]">Automação de afiliados</p>
        </div>
      </div>

      <nav className="flex gap-0.5 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ITENS.map(({ aba, label, Icon }) => (
          <button
            key={aba}
            type="button"
            onClick={() => onMudarAba(aba)}
            className={cn(
              "flex w-full flex-shrink-0 items-center gap-2.5 rounded-md px-3.5 py-2.5 text-left text-[13.5px] font-semibold whitespace-nowrap text-[#b8b8c8] transition-colors hover:bg-white/10 hover:text-white lg:whitespace-normal",
              abaAtiva === aba && "bg-primary text-white shadow-[0_2px_10px_rgba(106,92,255,0.5)] hover:bg-primary",
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-white/10 px-1.5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white">{usuario.nome || usuario.email}</p>
          {usuario.nome && <p className="truncate text-xs text-[#a8abc0]">{usuario.email}</p>}
        </div>
        <button
          type="button"
          onClick={onSair}
          title="Sair"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-[#b8b8c8] transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
