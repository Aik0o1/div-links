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
    <aside className="sticky top-0 z-20 flex w-full flex-shrink-0 flex-col gap-4 border-b border-border bg-card p-4 lg:h-screen lg:w-[260px] lg:gap-6 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-5">
      <div className="flex items-center gap-3 px-1.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-soft">
          <Link2 className="h-4.5 w-4.5 text-primary-foreground" />
        </span>
        <div>
          <h1 className="text-[17px] font-bold leading-tight tracking-tight text-foreground">PromoFlow</h1>
          <p className="text-xs text-muted-foreground">Automação de afiliados</p>
        </div>
      </div>

      <nav className="flex gap-0.5 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ITENS.map(({ aba, label, Icon }) => (
          <button
            key={aba}
            type="button"
            onClick={() => onMudarAba(aba)}
            className={cn(
              "flex w-full flex-shrink-0 items-center gap-2.5 rounded-md px-3.5 py-2.5 text-left text-[13.5px] font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:whitespace-normal",
              abaAtiva === aba && "bg-primary text-primary-foreground shadow-soft hover:bg-primary",
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-border px-1.5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">{usuario.nome || usuario.email}</p>
          {usuario.nome && <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>}
        </div>
        <button
          type="button"
          onClick={onSair}
          title="Sair"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
