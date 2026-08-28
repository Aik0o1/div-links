import {
  LayoutDashboard,
  Link2,
  MessageCircle,
  Send,
  Radio,
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
    <aside className="sticky top-0 z-20 flex w-full flex-shrink-0 flex-col gap-4 bg-primary p-4 lg:h-screen lg:w-[260px] lg:gap-6 lg:overflow-y-auto lg:p-5">
      <div className="flex items-center gap-3 px-1.5">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-foreground shadow-soft">
          <Link2 className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h1 className="text-lg font-extrabold leading-tight tracking-tight text-primary-foreground">PromoFlow</h1>
          <p className="text-xs text-primary-foreground/70">Automação de afiliados</p>
        </div>
      </div>

      <nav className="flex gap-0.5 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ITENS.map(({ aba, label, Icon }) => (
          <button
            key={aba}
            type="button"
            onClick={() => onMudarAba(aba)}
            className={cn(
              "flex w-full flex-shrink-0 items-center gap-2.5 rounded-md px-3.5 py-2.5 text-left text-[13.5px] font-semibold whitespace-nowrap text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground lg:whitespace-normal",
              abaAtiva === aba && "bg-primary-foreground text-primary shadow-soft hover:bg-primary-foreground",
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-primary-foreground/20 px-1.5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-primary-foreground">{usuario.nome || usuario.email}</p>
          {usuario.nome && <p className="truncate text-xs text-primary-foreground/70">{usuario.email}</p>}
        </div>
        <button
          type="button"
          onClick={onSair}
          title="Sair"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
