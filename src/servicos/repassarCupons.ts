import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cuponsRepo from "../repositorios/cupons.js";
import * as disparosRepo from "../repositorios/disparos.js";
import * as canaisRepo from "../repositorios/canais.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import { enviarFotoLocalComLegenda as enviarFotoLocalTelegram } from "../integracoes/telegram/bot.js";
import { enviarFotoLocalComLegenda as enviarFotoLocalWhatsapp } from "../integracoes/evolutionApi/bot.js";
import { extrairCupons, formatarLegendaCupons } from "./parsearCupons.js";
import { logger } from "../config/logger.js";

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BANNER_CUPOM = path.join(RAIZ_PROJETO, "src", "assets", "imgs", "MLimg.jpeg");

/**
 * Repassa um post do grupo de cupons monitorado pra todos os canais ativos.
 * Diferente do fluxo de produtos do Mercado Livre: sem nicho/desconto (esse
 * conteúdo não é por produto, é uma lista de cupons genéricos), e a imagem é
 * sempre o banner fixo local — nunca a arte original do post de origem. A
 * legenda também não é a mensagem crua repassada: extrai código+desconto de
 * cada cupom e remonta no formato fixo (ver parsearCupons.ts), sempre com o
 * link configurado na aba Configurações no final (nunca o link original do
 * post, que aponta pra lista de afiliado de quem administra aquele grupo).
 * Respeita só `intervalo_minimo_minutos` do canal, como anti-spam.
 */
export async function processarMensagem(texto: string): Promise<void> {
  const cupom = await cuponsRepo.inserirSeNovo(texto);
  if (!cupom) {
    logger.debug("mensagem de cupom duplicada, ignorada");
    return;
  }

  const cuponsExtraidos = extrairCupons(texto);
  if (cuponsExtraidos.length === 0) {
    logger.debug("mensagem sem cupom reconhecível (formato inesperado), ignorada");
    return;
  }

  const linkFixo = await configuracoesRepo.obterLinkCupomFixo();
  if (!linkFixo) {
    logger.warn(
      "link fixo de cupons não configurado (aba Configurações) — cupom capturado mas não repassado",
    );
    return;
  }

  const legenda = formatarLegendaCupons(cuponsExtraidos, linkFixo);

  const canais = (await canaisRepo.listar()).filter((c) => c.ativo);

  for (const canal of canais) {
    const ultimoEnvio = await disparosRepo.ultimoEnvioGeralPorCanal(canal.id);
    if (ultimoEnvio) {
      const minutosDesde = (Date.now() - new Date(ultimoEnvio).getTime()) / 60000;
      if (minutosDesde < canal.intervaloMinimoMinutos) continue;
    }

    try {
      const enviar = canal.tipo === "telegram" ? enviarFotoLocalTelegram : enviarFotoLocalWhatsapp;
      await enviar(BANNER_CUPOM, legenda, canal.identificadorGrupo);
      await cuponsRepo.registrarDisparo(cupom.id, canal.id, "enviado");
    } catch (err) {
      logger.error({ err, canalId: canal.id }, "falha ao repassar cupom pro canal");
      await cuponsRepo.registrarDisparo(cupom.id, canal.id, "falhou");
    }
  }
}
