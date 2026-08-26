import { Router, type Request, type Response } from "express";
import { statusInstancia, obterQrCode, listarGrupos } from "../../integracoes/evolutionApi/instancia.js";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";
import type { GrupoMonitoradoConfig } from "../../repositorios/configuracoes.js";
import { processarMensagemGrupo } from "../../servicos/processarMensagemGrupo.js";
import { validarLimiteGruposMonitorados } from "../../servicos/assinatura.js";
import { logger } from "../../config/logger.js";

export const rotaWhatsapp = Router();

rotaWhatsapp.get("/status", async (req, res) => {
  const status = await statusInstancia(req.usuarioId).catch(() => ({ existe: false, conectado: false, estado: null }));
  res.json(status);
});

rotaWhatsapp.get("/qrcode", async (req, res) => {
  try {
    const qrcode = await obterQrCode(req.usuarioId);
    res.json(qrcode);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaWhatsapp.get("/grupos", async (req, res) => {
  try {
    const grupos = await listarGrupos(req.usuarioId);
    res.json(grupos);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaWhatsapp.get("/grupos-monitorados", async (req, res) => {
  res.json(await configuracoesRepo.obterWhatsappGruposMonitorados(req.usuarioId));
});

rotaWhatsapp.post("/grupos-monitorados", async (req, res) => {
  const { grupos } = req.body as { grupos: GrupoMonitoradoConfig[] };
  if (!Array.isArray(grupos)) {
    res.status(400).json({ erro: "grupos (array de {id, nicho}) é obrigatório" });
    return;
  }
  const limite = await validarLimiteGruposMonitorados(req.usuarioId, "whatsapp", grupos.length);
  if (!limite.ok) {
    res.status(403).json({
      erro: `Seu plano permite até ${limite.limite} grupo(s) monitorado(s) no total (WhatsApp + Telegram). Essa seleção passaria de ${limite.total}.`,
    });
    return;
  }
  await configuracoesRepo.definirWhatsappGruposMonitorados(req.usuarioId, grupos);
  res.json({ ok: true, gruposMonitorados: grupos });
});

// Nome de instância é determinístico (`tenant-${usuarioId}`, ver
// integracoes/evolutionApi/instancia.ts) — o tenant dono do webhook é
// resolvido só com regex sobre `corpo.instance`, sem consulta ao banco.
const REGEX_TENANT_DA_INSTANCIA = /^tenant-(\d+)$/;

/**
 * Recebe o evento MESSAGES_UPSERT da Evolution API (ver
 * integracoes/evolutionApi/instancia.ts -> configurarWebhook). Responde 200
 * na hora e processa em segundo plano — a extração/scraping do produto pode
 * demorar bem mais que o timeout que a Evolution espera de um webhook.
 *
 * Extraído do router (em vez de `rotaWhatsapp.post("/webhook", ...)`) pra
 * poder ser registrado em app.ts ANTES do middleware de auth — é a Evolution
 * chamando o painel, não um usuário logado, então não tem cookie de sessão
 * nenhum pra validar. O tenant vem do nome da instância no próprio payload,
 * não de `req.usuarioId`.
 */
export function handlerWebhookWhatsapp(req: Request, res: Response): void {
  res.status(200).json({ ok: true });

  // Nota: o campo `apikey` desse payload é o hash da INSTÂNCIA (gerado na
  // criação, ex.: "28D7CA35-..."), não a EVOLUTION_API_KEY global — não dá
  // pra validar contra essa última (bug já cometido aqui: rejeitava todo
  // webhook real silenciosamente, só passava em teste sintético que usava a
  // chave errada de propósito). Sem verificação de origem por enquanto (mesmo
  // nível de confiança de antes do multi-tenant — a Evolution não expõe
  // validação de origem confiável).
  const corpo = req.body;
  if (corpo?.event !== "messages.upsert") return;

  const nomeInstancia: string | undefined = corpo.instance;
  const matchTenant = nomeInstancia ? REGEX_TENANT_DA_INSTANCIA.exec(nomeInstancia) : null;
  if (!matchTenant) {
    logger.warn({ nomeInstancia }, "webhook do WhatsApp com instância não reconhecível, ignorado");
    return;
  }
  const usuarioId = Number(matchTenant[1]);

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
    .obterWhatsappGruposMonitorados(usuarioId)
    .then((monitorados) => {
      const grupo = monitorados.find((g) => g.id === remoteJid);
      if (!grupo) return;
      return processarMensagemGrupo(usuarioId, texto, "whatsapp", grupo.nicho, remoteJid);
    })
    .catch((err) => {
      logger.error({ err, usuarioId, remoteJid }, "falha ao processar webhook do WhatsApp");
    });
}
