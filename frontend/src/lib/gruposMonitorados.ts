import { api } from "@/lib/api";

export interface GrupoMonitoradoOpcao {
  id: string;
  nome: string;
  plataforma: "whatsapp" | "telegram";
}

export interface DialogoComStatus extends GrupoMonitoradoOpcao {
  /** Nicho já configurado globalmente pra esse grupo — null quando ainda não está sendo monitorado por ninguém. */
  nichoAtual: string | null;
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

/**
 * TODOS os grupos/canais que a conta participa em cada plataforma (não só
 * os já monitorados) — usado no formulário de canal (CanalDialog) pra
 * escolher, na hora de criar/editar um canal de destino, quais grupos ele
 * vai monitorar, sem precisar passar por uma aba separada antes. `nichoAtual`
 * vem preenchido quando o grupo já está sendo monitorado por QUALQUER canal
 * (não só o que está sendo editado agora).
 */
export async function buscarTodosDialogosComStatus(): Promise<DialogoComStatus[]> {
  const [wMonitorados, wGrupos, tStatus, tGrupos] = await Promise.all([
    api<{ id: string; nicho: string }[]>("/whatsapp/grupos-monitorados").catch(() => []),
    api<{ jid: string; nome: string }[]>("/whatsapp/grupos").catch(() => []),
    api<{ gruposMonitorados: { id: string; nicho: string }[] }>("/telegram-listener/status").catch(() => ({
      gruposMonitorados: [],
    })),
    api<{ id: string; nome: string }[]>("/telegram-listener/grupos").catch(() => []),
  ]);

  const nichoWhats = new Map(wMonitorados.map((g) => [g.id, g.nicho]));
  const nichoTelegram = new Map(tStatus.gruposMonitorados.map((g) => [g.id, g.nicho]));

  return [
    ...wGrupos.map((g) => ({ id: g.jid, nome: g.nome, plataforma: "whatsapp" as const, nichoAtual: nichoWhats.get(g.jid) ?? null })),
    ...tGrupos.map((g) => ({ id: g.id, nome: g.nome, plataforma: "telegram" as const, nichoAtual: nichoTelegram.get(g.id) ?? null })),
  ];
}

/**
 * Marca os grupos passados como monitorados globalmente, com o nicho
 * escolhido agora — faz um MERGE com o que já está salvo pra cada
 * plataforma (nunca substitui a lista inteira), pra não desmonitorar sem
 * querer um grupo que outro canal ainda depende (ver CanalDialog).
 */
export async function marcarGruposComoMonitorados(
  grupos: { id: string; nome: string; nicho: string; plataforma: "whatsapp" | "telegram" }[],
): Promise<void> {
  const doWhatsapp = grupos.filter((g) => g.plataforma === "whatsapp");
  const doTelegram = grupos.filter((g) => g.plataforma === "telegram");

  if (doWhatsapp.length > 0) {
    const atual = await api<{ id: string; nicho: string; nome?: string }[]>("/whatsapp/grupos-monitorados").catch(() => []);
    const mapa = new Map(atual.map((g) => [g.id, { nicho: g.nicho, nome: g.nome }]));
    for (const g of doWhatsapp) mapa.set(g.id, { nicho: g.nicho, nome: g.nome });
    await api("/whatsapp/grupos-monitorados", {
      method: "POST",
      body: JSON.stringify({ grupos: Array.from(mapa, ([id, v]) => ({ id, ...v })) }),
    });
  }

  if (doTelegram.length > 0) {
    const status = await api<{ gruposMonitorados: { id: string; nicho: string; nome?: string }[] }>(
      "/telegram-listener/status",
    ).catch(() => ({ gruposMonitorados: [] }));
    const mapa = new Map(status.gruposMonitorados.map((g) => [g.id, { nicho: g.nicho, nome: g.nome }]));
    for (const g of doTelegram) mapa.set(g.id, { nicho: g.nicho, nome: g.nome });
    await api("/telegram-listener/grupos-monitorados", {
      method: "POST",
      body: JSON.stringify({ grupos: Array.from(mapa, ([id, v]) => ({ id, ...v })) }),
    });
  }
}
