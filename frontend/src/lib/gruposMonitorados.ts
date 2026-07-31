import { api } from "@/lib/api";

export interface GrupoMonitoradoOpcao {
  id: string;
  nome: string;
  plataforma: "whatsapp" | "telegram";
}

/** Combina as rotas de grupo monitorado + listagem já existentes (WhatsApp e Telegram) — sem endpoint novo, mesmo padrão usado em CanalDialog/GruposMonitorados/Cupons. */
export async function buscarGruposMonitoradosDisponiveis(): Promise<GrupoMonitoradoOpcao[]> {
  const [wMonitorados, wGrupos, tStatus, tGrupos] = await Promise.all([
    api<{ id: string; nicho: string }[]>("/whatsapp/grupos-monitorados").catch(() => []),
    api<{ jid: string; nome: string }[]>("/whatsapp/grupos").catch(() => []),
    api<{ gruposMonitorados: { id: string; nicho: string }[] }>("/telegram-listener/status").catch(() => ({
      gruposMonitorados: [],
    })),
    api<{ id: string; nome: string }[]>("/telegram-listener/grupos").catch(() => []),
  ]);

  const nomesWhats = new Map(wGrupos.map((g) => [g.jid, g.nome]));
  const nomesTelegram = new Map(tGrupos.map((g) => [g.id, g.nome]));

  return [
    ...wMonitorados.map((g) => ({ id: g.id, nome: nomesWhats.get(g.id) ?? g.id, plataforma: "whatsapp" as const })),
    ...tStatus.gruposMonitorados.map((g) => ({
      id: g.id,
      nome: nomesTelegram.get(g.id) ?? g.id,
      plataforma: "telegram" as const,
    })),
  ];
}
