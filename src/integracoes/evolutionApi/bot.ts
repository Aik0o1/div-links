import { readFileSync } from "node:fs";
import { requiredEvolutionConfig } from "../../config/env.js";
import { chamarEvolutionApi } from "./cliente.js";

// Mesmo limite conservador do Telegram (a Evolution/Baileys não documenta um
// limite explícito de legenda, mas seguir o mais restrito evita truncar cupom).
const LIMITE_LEGENDA = 1024;

/** @param grupoJid formato "xxxxxxxxxx-xxxxxxxxxx@g.us" (ver aba Status -> Grupos do WhatsApp) */
export async function enviarFotoComLegenda(
  fotoUrl: string,
  legenda: string,
  grupoJid: string,
): Promise<void> {
  const { instancia } = requiredEvolutionConfig();

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

export async function enviarTexto(texto: string, grupoJid: string): Promise<void> {
  const { instancia } = requiredEvolutionConfig();

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
  caminhoArquivo: string,
  legenda: string,
  grupoJid: string,
): Promise<void> {
  const { instancia } = requiredEvolutionConfig();
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
    await enviarTexto(legenda, grupoJid);
  }
}
