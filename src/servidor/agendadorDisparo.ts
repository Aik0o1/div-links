import * as canaisRepo from "../repositorios/canais.js";
import * as disparosRepo from "../repositorios/disparos.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import { proximoProdutoElegivel, dispararParaCanal } from "../servicos/dispararProduto.js";
import { dispararCupomPendente } from "../servicos/repassarCupons.js";
import { logger } from "../config/logger.js";

const INTERVALO_VERIFICACAO_MS = 60 * 1000; // confere a cada 1 minuto quais canais estão "na hora"

async function processarCanal(canal: Awaited<ReturnType<typeof canaisRepo.listar>>[number]) {
  const ultimoEnvio = await disparosRepo.ultimoEnvioGeralPorCanal(canal.id);
  if (ultimoEnvio) {
    const minutosDesde = (Date.now() - new Date(ultimoEnvio).getTime()) / 60000;
    if (minutosDesde < canal.intervaloMinimoMinutos) return;
  }

  // Cupom de grupo monitorado tem prioridade máxima — mais até que produto
  // de grupo monitorado (que já fura a fila de produtos, ver
  // produtosRepo.listarPorNichos). Só passa pro produto se não tiver cupom
  // pendente pra esse canal.
  const cupomPendente = await dispararCupomPendente(canal);
  if (cupomPendente) {
    if (cupomPendente.status === "enviado") {
      logger.info(
        { canalId: canal.id, cupomId: cupomPendente.cupomId },
        "cupom pendente repassado (prioridade máxima)",
      );
    } else {
      logger.error(
        { canalId: canal.id, cupomId: cupomPendente.cupomId },
        "falha ao repassar cupom pendente (prioridade máxima)",
      );
    }
    return;
  }

  const produto = await proximoProdutoElegivel(canal);
  if (!produto) return;

  try {
    await dispararParaCanal(produto.id, canal.id);
    logger.info(
      { produtoId: produto.id, canalId: canal.id, titulo: produto.titulo },
      "disparo automático enviado",
    );
  } catch (err) {
    logger.error({ err, canalId: canal.id, produtoId: produto.id }, "falha no disparo automático");
  }
}

async function verificarTodosOsCanais(): Promise<void> {
  const ativo = await configuracoesRepo.obterDisparoAutomaticoAtivo();
  if (!ativo) return;

  const canais = await canaisRepo.listar();
  for (const canal of canais.filter((c) => c.ativo)) {
    await processarCanal(canal);
  }
}

export function iniciarAgendadorDisparo(): void {
  verificarTodosOsCanais();
  setInterval(verificarTodosOsCanais, INTERVALO_VERIFICACAO_MS);
  logger.info("agendador de disparo automático rodando (confere a cada 1 min)");
}
