import { readFileSync } from "node:fs";
import { requiredTelegramConfig } from "../../config/env.js";

// Limite real da Bot API pra legenda de mídia (sendPhoto.caption): 1024 caracteres.
const LIMITE_LEGENDA = 1024;

export async function enviarFotoComLegenda(
  fotoUrl: string,
  legenda: string,
  chatId: string,
): Promise<void> {
  const { botToken } = requiredTelegramConfig();

  const resposta = await fetch(
    `https://api.telegram.org/bot${botToken}/sendPhoto`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: fotoUrl,
        caption: legenda,
        parse_mode: "Markdown",
      }),
    },
  );

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`Falha ao enviar foto pro Telegram (${resposta.status}): ${corpo}`);
  }
}

export async function enviarTexto(texto: string, chatId: string): Promise<void> {
  const { botToken } = requiredTelegramConfig();

  const resposta = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "Markdown" }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`Falha ao enviar texto pro Telegram (${resposta.status}): ${corpo}`);
  }
}

/**
 * Envia uma imagem local (não uma URL pública) — usado pro banner fixo dos
 * cupons repassados, já que o painel roda só em localhost e o Telegram
 * precisaria buscar a URL publicamente se fosse pelo campo `photo` normal.
 * Se a legenda passar do limite da Bot API, manda a foto sem legenda e o
 * texto completo em seguida, pra não cortar cupom no meio.
 */
export async function enviarFotoLocalComLegenda(
  caminhoArquivo: string,
  legenda: string,
  chatId: string,
): Promise<void> {
  const { botToken } = requiredTelegramConfig();

  const legendaCabe = legenda.length <= LIMITE_LEGENDA;
  const buffer = readFileSync(caminhoArquivo);
  const form = new FormData();
  form.append("chat_id", chatId);
  if (legendaCabe) {
    form.append("caption", legenda);
    form.append("parse_mode", "Markdown");
  }
  form.append("photo", new Blob([buffer], { type: "image/jpeg" }), "imagem.jpeg");

  const resposta = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: "POST",
    body: form,
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`Falha ao enviar foto local pro Telegram (${resposta.status}): ${corpo}`);
  }

  if (!legendaCabe) {
    await enviarTexto(legenda, chatId);
  }
}
