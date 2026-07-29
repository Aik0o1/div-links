import { Router } from "express";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { statusInstancia, obterQrCode, listarGrupos, obterMidiaBase64 } from "../../integracoes/evolutionApi/instancia.js";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";
import type { GrupoMonitoradoConfig } from "../../repositorios/configuracoes.js";
import { processarMensagemGrupo } from "../../servicos/processarMensagemGrupo.js";
import { logger } from "../../config/logger.js";

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DIR_IMAGENS_CAPTURADAS = path.join(RAIZ_PROJETO, "data", "imagens-capturadas");

/**
 * Devolve uma função que baixa a imagem da mensagem SÓ SE for chamada (mesmo
 * padrão do Telegram, ver criarBaixadorImagem em telegramListener/cliente.ts)
 * — evita chamar a Evolution à toa pra mensagens que não precisam da imagem
 * (hoje, só a captura de produto Shopee).
 */
function criarBaixadorImagemWhatsapp(dados: any): () => Promise<string | undefined> {
  return async () => {
    if (!dados.message?.imageMessage) return undefined;
    try {
      const base64 = await obterMidiaBase64(dados);
      if (!base64) return undefined;
      await mkdir(DIR_IMAGENS_CAPTURADAS, { recursive: true });
      const caminho = path.join(DIR_IMAGENS_CAPTURADAS, `wa-${dados.key.id}.jpg`);
      await writeFile(caminho, Buffer.from(base64, "base64"));
      return caminho;
    } catch (err) {
      logger.warn({ err, msgId: dados.key?.id }, "falha ao baixar imagem da mensagem do WhatsApp, seguindo sem imagem");
      return undefined;
    }
  };
}

export const rotaWhatsapp = Router();

rotaWhatsapp.get("/status", async (_req, res) => {
  const status = await statusInstancia().catch(() => ({ existe: false, conectado: false, estado: null }));
  res.json(status);
});

rotaWhatsapp.get("/qrcode", async (_req, res) => {
  try {
    const qrcode = await obterQrCode();
    res.json(qrcode);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaWhatsapp.get("/grupos", async (_req, res) => {
  try {
    const grupos = await listarGrupos();
    res.json(grupos);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaWhatsapp.get("/grupos-monitorados", async (_req, res) => {
  res.json(await configuracoesRepo.obterWhatsappGruposMonitorados());
});

rotaWhatsapp.post("/grupos-monitorados", async (req, res) => {
  const { grupos } = req.body as { grupos: GrupoMonitoradoConfig[] };
  if (!Array.isArray(grupos)) {
    res.status(400).json({ erro: "grupos (array de {id, nicho}) é obrigatório" });
    return;
  }
  await configuracoesRepo.definirWhatsappGruposMonitorados(grupos);
  res.json({ ok: true, gruposMonitorados: grupos });
});

/**
 * Recebe o evento MESSAGES_UPSERT da Evolution API (ver
 * integracoes/evolutionApi/instancia.ts -> configurarWebhook). Responde 200
 * na hora e processa em segundo plano — a extração/scraping do produto pode
 * demorar bem mais que o timeout que a Evolution espera de um webhook.
 */
rotaWhatsapp.post("/webhook", (req, res) => {
  res.status(200).json({ ok: true });

  // Nota: o campo `apikey` desse payload é o hash da INSTÂNCIA (gerado na
  // criação, ex.: "28D7CA35-..."), não a EVOLUTION_API_KEY global — não dá
  // pra validar contra essa última (bug já cometido aqui: rejeitava todo
  // webhook real silenciosamente, só passava em teste sintético que usava a
  // chave errada de propósito). Sem verificação de origem por enquanto.
  const corpo = req.body;
  if (corpo?.event !== "messages.upsert") return;

  const dados = corpo.data;
  if (!dados || dados.key?.fromMe) return; // ignora mensagem enviada por nós mesmos

  const remoteJid: string | undefined = dados.key?.remoteJid;
  if (!remoteJid || !remoteJid.endsWith("@g.us")) return; // só grupo

  const texto: string | undefined =
    dados.message?.conversation ||
    dados.message?.extendedTextMessage?.text ||
    dados.message?.imageMessage?.caption ||
    dados.message?.videoMessage?.caption;
  if (!texto) return;

  configuracoesRepo
    .obterWhatsappGruposMonitorados()
    .then((monitorados) => {
      const grupo = monitorados.find((g) => g.id === remoteJid);
      if (!grupo) return;
      return processarMensagemGrupo(texto, "whatsapp", grupo.nicho, criarBaixadorImagemWhatsapp(dados), remoteJid);
    })
    .catch((err) => {
      logger.error({ err, remoteJid }, "falha ao processar webhook do WhatsApp");
    });
});
