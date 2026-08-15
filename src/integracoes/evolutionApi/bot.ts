import { readFileSync } from "node:fs";
import { chamarEvolutionApi } from "./cliente.js";
import { nomeInstanciaEvolution } from "./instancia.js";

// Mesmo limite conservador do Telegram (a Evolution/Baileys não documenta um
// limite explícito de legenda, mas seguir o mais restrito evita truncar cupom).
const LIMITE_LEGENDA = 1024;

/** @param grupoJid formato "xxxxxxxxxx-xxxxxxxxxx@g.us" (ver aba Status -> Grupos do WhatsApp) */
export async function enviarFotoComLegenda(
  usuarioId: number,
  fotoUrl: string,
  legenda: string,
  grupoJid: string,
): Promise<void> {
  const instancia = nomeInstanciaEvolution(usuarioId);

  await chamarEvolutionApi(`/message/sendMedia/${instancia}`, {
    method: "POST",
    body: {
      number: grupoJid,
      mediatype: "image",
      media: fotoUrl,
      caption: legenda,
    },
  });
}

export async function enviarTexto(usuarioId: number, texto: string, grupoJid: string): Promise<void> {
  const instancia = nomeInstanciaEvolution(usuarioId);

  await chamarEvolutionApi(`/message/sendText/${instancia}`, {
    method: "POST",
    body: { number: grupoJid, text: texto },
  });
}

/**
 * Envia uma imagem local (não uma URL pública) — usado pro banner fixo dos
 * cupons repassados. A Evolution API aceita base64 puro no campo `media`
 * (sem prefixo "data:"), então lemos o arquivo e codificamos direto.
 */
export async function enviarFotoLocalComLegenda(
  usuarioId: number,
  caminhoArquivo: string,
  legenda: string,
  grupoJid: string,
): Promise<void> {
  const instancia = nomeInstanciaEvolution(usuarioId);
  const legendaCabe = legenda.length <= LIMITE_LEGENDA;
  const base64 = readFileSync(caminhoArquivo).toString("base64");

  await chamarEvolutionApi(`/message/sendMedia/${instancia}`, {
    method: "POST",
    body: {
      number: grupoJid,
      mediatype: "image",
      media: base64,
      ...(legendaCabe ? { caption: legenda } : {}),
    },
  });

  if (!legendaCabe) {
    await enviarTexto(usuarioId, legenda, grupoJid);
  }
}
