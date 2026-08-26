import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cuponsRepo from "../repositorios/cupons.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import { enviarFotoLocalComLegenda as enviarFotoLocalTelegram } from "../integracoes/telegram/bot.js";
import { enviarFotoLocalComLegenda as enviarFotoLocalWhatsapp } from "../integracoes/evolutionApi/bot.js";
import { extrairCupons, formatarLegendaCupons, detectarPlataformaCupom } from "./parsearCupons.js";
import { gerarLinkAfiliado as gerarLinkAfiliadoShopee } from "../integracoes/shopee/api.js";
import { comMarcaDaguaSeTrial } from "./marcaDagua.js";
import { logger } from "../config/logger.js";
import type { CanalRow } from "../repositorios/canais.js";

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BANNER_CUPOM_ML = path.join(RAIZ_PROJETO, "src", "assets", "imgs", "MLimg.jpeg");
// Convertido de .webp pra .jpeg (ver src/assets/imgs/shopee.webp original) —
// o envio local pro Telegram (enviarFotoLocalComLegenda) manda o Blob sempre
// como image/jpeg fixo, então um .webp de verdade sairia com o tipo errado;
// mais simples converter uma vez do que mudar a detecção de mime-type.
const BANNER_CUPOM_SHOPEE = path.join(RAIZ_PROJETO, "src", "assets", "imgs", "shopee.jpeg");

/**
 * Só captura e valida o post do grupo de cupons monitorado — não tenta
 * repassar na hora. Quem repassa é `dispararCupomPendente`, chamado pelo
 * agendador de disparo (`agendadorDisparo.ts`) com prioridade máxima (antes
 * de qualquer produto). Motivo: repassar na hora era "tentativa única" — se
 * o intervalo mínimo do canal ainda não tivesse passado naquele exato
 * momento, o cupom era perdido pra sempre, sem nenhuma retentativa depois
 * (bug real: cupom chegou 2min depois do último disparo pro canal, que
 * exige 5min de intervalo — nunca foi reenviado).
 */
export async function processarMensagem(usuarioId: number, texto: string, grupoOrigemId?: string): Promise<void> {
  const cupom = await cuponsRepo.inserirSeNovo(usuarioId, texto, grupoOrigemId);
  if (!cupom) {
    logger.debug("mensagem de cupom duplicada, ignorada");
    return;
  }

  const cuponsExtraidos = extrairCupons(texto);
  if (cuponsExtraidos.length === 0) {
    logger.debug("mensagem sem cupom reconhecível (formato inesperado), ignorada");
    return;
  }

  logger.info(
    { cupomId: cupom.id, cupons: cuponsExtraidos.map((c) => c.codigo) },
    "cupom de grupo monitorado capturado — entra na fila com prioridade máxima sobre produtos",
  );
}

export interface ResultadoCupomPendente {
  cupomId: number;
  status: "enviado" | "falhou";
}

/**
 * Tenta repassar o cupom pendente mais antigo pra esse canal (FIFO,
 * ignorando os que já foram enviados com sucesso pra ele — os que só
 * falharam antes continuam pendentes, pra retentativa). Devolve `null` se
 * não há nenhum cupom pendente parseável pra esse canal agora (aí o
 * agendador segue pro fluxo normal de produtos).
 */
export async function dispararCupomPendente(usuarioId: number, canal: CanalRow): Promise<ResultadoCupomPendente | null> {
  const candidatos = await cuponsRepo.listarPendentesParaCanal(usuarioId, canal.id);
  if (candidatos.length === 0) return null;

  // Link fixo é config específica do Mercado Livre (lista de recomendações)
  // — cupom da Shopee usa o link de afiliado gerado a partir do próprio link
  // que veio no post (ver detectarPlataformaCupom). Por isso não busca/exige
  // aqui em cima mais: um cupom da Shopee não pode ficar bloqueado só porque
  // o link fixo do ML não foi configurado.
  const linkFixo = await configuracoesRepo.obterLinkCupomFixo(usuarioId);

  for (const cupom of candidatos) {
    const cuponsExtraidos = extrairCupons(cupom.texto);
    if (cuponsExtraidos.length === 0) continue; // formato não reconhecível, nunca vai ser repassável

    const { plataforma, urlShopee } = detectarPlataformaCupom(cupom.texto);

    // Só Shopee e Mercado Livre têm geração de link de afiliado/despacho
    // automático hoje — cupom de outro marketplace (AliExpress, Amazon,
    // Magalu...) nunca deve ser despachado com o link fixo do ML por engano
    // (bug real: cupom do AliExpress saiu rotulado e tratado como se fosse
    // do ML). Fica só capturado (visível na aba Cupons do painel), sem
    // repassar automaticamente — pula pro próximo candidato.
    if (plataforma !== "shopee" && plataforma !== "mercado_livre") continue;

    let link: string;
    if (plataforma === "shopee" && urlShopee) {
      try {
        link = await gerarLinkAfiliadoShopee(usuarioId, urlShopee);
      } catch (err) {
        logger.error(
          { err, cupomId: cupom.id },
          "falha ao gerar link de afiliado Shopee pro cupom repassado — pula, tenta de novo no próximo ciclo",
        );
        continue;
      }
    } else {
      if (!linkFixo) continue; // cupom do ML precisa do link fixo configurado — sem ele, pula (não é falha permanente)
      link = linkFixo;
    }

    const legenda = await comMarcaDaguaSeTrial(usuarioId, formatarLegendaCupons(cuponsExtraidos, link, plataforma));
    const banner = plataforma === "shopee" ? BANNER_CUPOM_SHOPEE : BANNER_CUPOM_ML;
    try {
      if (canal.tipo === "telegram") {
        await enviarFotoLocalTelegram(banner, legenda, canal.identificadorGrupo);
      } else {
        await enviarFotoLocalWhatsapp(usuarioId, banner, legenda, canal.identificadorGrupo);
      }
      await cuponsRepo.registrarDisparo(usuarioId, cupom.id, canal.id, "enviado");
      return { cupomId: cupom.id, status: "enviado" };
    } catch (err) {
      logger.error({ err, canalId: canal.id, cupomId: cupom.id }, "falha ao repassar cupom pro canal");
      await cuponsRepo.registrarDisparo(usuarioId, cupom.id, canal.id, "falhou");
      return { cupomId: cupom.id, status: "falhou" };
    }
  }

  return null;
}
