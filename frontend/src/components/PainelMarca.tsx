import { Search, Tag, Send, Link2 } from "lucide-react";

const ETAPAS = [
  {
    icone: Search,
    titulo: "Captura",
    texto: "Vê uma oferta nova no Mercado Livre, na Shopee ou num grupo monitorado",
  },
  {
    icone: Tag,
    titulo: "Monta o cupom",
    texto: "Calcula preço, cupom e a chamada certa pro produto",
  },
  {
    icone: Send,
    titulo: "Dispara",
    texto: "Manda pro WhatsApp e pro Telegram sozinho, 24 horas por dia",
  },
];

/**
 * Painel de marca da tela de login/cadastro — só aparece em telas largas
 * (o formulário fica sozinho no mobile, ver Login.tsx/Signup.tsx). O
 * pipeline numerado é literal: é a sequência real que o sistema roda pra
 * cada produto (capturarProdutos → cupom/preço → dispararProduto), não
 * uma decoração genérica.
 */
export function PainelMarca({ headline }: { headline: string }) {
  return (
    <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-b from-sidebar to-[#142a63] p-12 text-white lg:flex">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
          <Link2 className="h-5 w-5" />
        </span>
        <span className="font-display text-lg font-semibold">PromoFlow</span>
      </div>

      <div className="max-w-sm">
        <p className="text-xs font-semibold tracking-[0.14em] text-white/50 uppercase">Automação de ofertas</p>
        <h2 className="mt-3 font-display text-3xl leading-tight font-semibold text-balance">{headline}</h2>

        <ol className="relative mt-10 flex flex-col gap-8 pl-2">
          {/* Linha vertical conectando as 3 etapas */}
          <div className="absolute top-4 bottom-4 left-[19px] w-px bg-white/15" />
          {ETAPAS.map(({ icone: Icone, titulo, texto }, i) => (
            <li key={titulo} className="relative flex gap-4">
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                <Icone className="h-4 w-4" />
              </span>
              <div className="pt-1.5">
                <p className="font-display text-sm font-semibold text-white/95">
                  <span className="mr-1.5 text-white/40">0{i + 1}</span>
                  {titulo}
                </p>
                <p className="mt-0.5 text-sm text-white/65">{texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-white/40">© 2026 PromoFlow</p>
    </div>
  );
}
