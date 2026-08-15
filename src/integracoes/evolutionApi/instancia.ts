import { requiredEvolutionConfig, env } from "../../config/env.js";
import { chamarEvolutionApi } from "./cliente.js";
import { logger } from "../../config/logger.js";

/**
 * Nome de instância determinístico por tenant — sem coluna nova pra
 * sincronizar (ver plano multi-tenant, item 6). A Evolution API (container
 * único, self-hosted) já suporta múltiplas instâncias nativamente; cada
 * tenant conecta o PRÓPRIO WhatsApp numa instância isolada com esse nome.
 */
export function nomeInstanciaEvolution(usuarioId: number): string {
  return `tenant-${usuarioId}`;
}

export interface StatusInstancia {
  existe: boolean;
  conectado: boolean;
  estado: string | null;
}

export async function statusInstancia(usuarioId: number): Promise<StatusInstancia> {
  requiredEvolutionConfig();
  const instancia = nomeInstanciaEvolution(usuarioId);
  try {
    const resposta = await chamarEvolutionApi(`/instance/connectionState/${instancia}`);
    const estado = resposta?.instance?.state ?? null;
    return { existe: !!estado, conectado: estado === "open", estado };
  } catch {
    return { existe: false, conectado: false, estado: null };
  }
}

export interface QrCode {
  base64: string | null;
  pairingCode: string | null;
}

/** Cria a instância se ainda não existir e devolve o QR code pra parear o WhatsApp. */
export async function obterQrCode(usuarioId: number): Promise<QrCode> {
  requiredEvolutionConfig();
  const instancia = nomeInstanciaEvolution(usuarioId);
  const status = await statusInstancia(usuarioId);

  if (status.conectado) {
    return { base64: null, pairingCode: null };
  }

  if (!status.existe) {
    const resposta = await chamarEvolutionApi("/instance/create", {
      method: "POST",
      body: { instanceName: instancia, qrcode: true, integration: "WHATSAPP-BAILEYS" },
    });
    // Configura o webhook já na criação da instância — antes rodava uma vez
    // fixo em iniciar.ts (uma instância global só); agora cada tenant cria a
    // própria instância nesse fluxo, então é aqui que faz sentido garantir o
    // webhook dela. Idempotente, não bloqueia a resposta do QR code se falhar.
    configurarWebhook(usuarioId).catch((err) => {
      logger.warn({ err, usuarioId }, "não deu pra configurar o webhook da instância recém-criada");
    });
    return {
      base64: resposta?.qrcode?.base64 ?? null,
      pairingCode: resposta?.qrcode?.pairingCode ?? null,
    };
  }

  const resposta = await chamarEvolutionApi(`/instance/connect/${instancia}`);
  return {
    base64: resposta?.base64 ?? resposta?.qrcode?.base64 ?? null,
    pairingCode: resposta?.pairingCode ?? resposta?.qrcode?.pairingCode ?? null,
  };
}

export interface GrupoWhatsapp {
  jid: string;
  nome: string;
}

/** Lista os grupos que a instância conectada participa — usado pra descobrir o JID de um grupo. */
export async function listarGrupos(usuarioId: number): Promise<GrupoWhatsapp[]> {
  const instancia = nomeInstanciaEvolution(usuarioId);
  const resposta = await chamarEvolutionApi(
    `/group/fetchAllGroups/${instancia}?getParticipants=false`,
  );
  const grupos = Array.isArray(resposta) ? resposta : [];
  return grupos.map((g: any) => ({ jid: g.id, nome: g.subject ?? g.id }));
}

/**
 * Configura o webhook da instância pra entregar MESSAGES_UPSERT (mensagem
 * nova, inclusive de grupo) pro nosso painel — `host.docker.internal`
 * porque a Evolution roda dentro do Docker e o painel roda fora (npm run
 * ui), ver `extra_hosts` no docker-compose.yml. Idempotente, seguro de
 * chamar toda vez que o tenant conecta o WhatsApp (só reafirma a config).
 * Antes rodava uma vez fixo em iniciar.ts (uma instância global); agora
 * roda por tenant, dentro do fluxo de conectar WhatsApp (ver obterQrCode /
 * rotas/whatsapp.ts).
 */
export async function configurarWebhook(usuarioId: number): Promise<void> {
  const instancia = nomeInstanciaEvolution(usuarioId);
  const url = `http://host.docker.internal:${env.portaUi}/api/whatsapp/webhook`;

  await chamarEvolutionApi(`/webhook/set/${instancia}`, {
    method: "POST",
    body: {
      webhook: {
        enabled: true,
        url,
        byEvents: false,
        base64: false,
        events: ["MESSAGES_UPSERT"],
      },
    },
  });
}
