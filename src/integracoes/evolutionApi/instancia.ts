import { requiredEvolutionConfig, env } from "../../config/env.js";
import { chamarEvolutionApi } from "./cliente.js";

export interface StatusInstancia {
  existe: boolean;
  conectado: boolean;
  estado: string | null;
}

export async function statusInstancia(): Promise<StatusInstancia> {
  const { instancia } = requiredEvolutionConfig();
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
export async function obterQrCode(): Promise<QrCode> {
  const { instancia } = requiredEvolutionConfig();
  const status = await statusInstancia();

  if (status.conectado) {
    return { base64: null, pairingCode: null };
  }

  if (!status.existe) {
    const resposta = await chamarEvolutionApi("/instance/create", {
      method: "POST",
      body: { instanceName: instancia, qrcode: true, integration: "WHATSAPP-BAILEYS" },
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
export async function listarGrupos(): Promise<GrupoWhatsapp[]> {
  const { instancia } = requiredEvolutionConfig();
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
 * chamar toda subida do servidor (só reafirma a config).
 */
export async function configurarWebhook(): Promise<void> {
  const { instancia } = requiredEvolutionConfig();
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
