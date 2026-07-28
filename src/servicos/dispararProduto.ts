import * as produtosRepo from "../repositorios/produtos.js";
import * as canaisRepo from "../repositorios/canais.js";
import * as disparosRepo from "../repositorios/disparos.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import { gerarLinkAfiliado } from "../linkAfiliado/index.js";
import { gerarLegenda } from "../legenda/gerarLegenda.js";
import { enviarFotoComLegenda as enviarFotoTelegram } from "../integracoes/telegram/bot.js";
import { enviarFotoComLegenda as enviarFotoWhatsapp } from "../integracoes/evolutionApi/bot.js";
import { gerarChamada } from "../integracoes/ollama/gerarChamada.js";
import { calcularDesconto } from "./calcularDesconto.js";
import { logger } from "../config/logger.js";
import type { CanalRow } from "../repositorios/canais.js";
import type { ProdutoRow } from "../repositorios/produtos.js";

export interface CanalComElegibilidade extends CanalRow {
  elegivel: boolean;
  motivo?: string;
}

// Nicho especial que representa "sem filtro" (aba geral de Ofertas).
const NICHO_GERAL = "geral";

// Depois desse número de falhas, o produto é marcado "falhou" e some da
// fila — sem isso, um produto com falha permanente (ex.: ML rejeita o link
// de afiliado, "Este URL não é permitido pelo Programa") ficava sendo
// retentado pra sempre a cada ciclo (é sempre o mais antigo "capturado",
// então nunca sai da frente da fila) — bloqueando TODOS os produtos atrás
// dele indefinidamente. Bug real: fila inteira travada por ~30min atrás de
// um único produto de categoria não elegível pro programa de afiliados.
const LIMITE_FALHAS = 3;

// Canal sem categorias definidas só aceita produtos do nicho "geral" — não "qualquer um".
function nichoElegivel(canal: CanalRow, nichoProduto: string | null): boolean {
  const permitidas = canal.categoriasPermitidas;
  if (permitidas && permitidas.length > 0) {
    return nichoProduto ? permitidas.includes(nichoProduto) : false;
  }
  return nichoProduto === NICHO_GERAL;
}

export async function canaisElegiveis(produtoId: number): Promise<CanalComElegibilidade[]> {
  const produto = await produtosRepo.buscarPorId(produtoId);
  if (!produto) throw new Error(`Produto ${produtoId} não encontrado`);

  const canais = await canaisRepo.listar();
  const desconto = calcularDesconto(produto.precoOriginal, produto.precoPromocional);

  const resultado: CanalComElegibilidade[] = [];

  for (const canal of canais) {
    if (!canal.ativo) {
      resultado.push({ ...canal, elegivel: false, motivo: "canal desativado" });
      continue;
    }

    if (!nichoElegivel(canal, produto.nicho)) {
      const motivo =
        canal.categoriasPermitidas && canal.categoriasPermitidas.length > 0
          ? `categoria "${produto.nicho}" não permitida nesse canal`
          : `canal sem categorias definidas só aceita nicho "${NICHO_GERAL}" (produto é "${produto.nicho}")`;
      resultado.push({ ...canal, elegivel: false, motivo });
      continue;
    }

    if (desconto < canal.descontoMinimo) {
      resultado.push({
        ...canal,
        elegivel: false,
        motivo: `desconto de ${desconto}% abaixo do mínimo do canal (${canal.descontoMinimo}%)`,
      });
      continue;
    }

    const ultimoEnvio = await disparosRepo.ultimoEnvioGeralPorCanal(canal.id);
    if (ultimoEnvio) {
      const minutosDesde = (Date.now() - new Date(ultimoEnvio).getTime()) / 60000;
      if (minutosDesde < canal.intervaloMinimoMinutos) {
        const faltam = Math.ceil(canal.intervaloMinimoMinutos - minutosDesde);
        resultado.push({
          ...canal,
          elegivel: false,
          motivo: `intervalo mínimo entre disparos não passou (faltam ${faltam} min)`,
        });
        continue;
      }
    }

    resultado.push({ ...canal, elegivel: true });
  }

  return resultado;
}

/** Acha o próximo produto capturado (mais antigo primeiro) elegível pras regras do canal. */
export async function proximoProdutoElegivel(canal: CanalRow): Promise<ProdutoRow | null> {
  const nichosAceitos =
    canal.categoriasPermitidas && canal.categoriasPermitidas.length > 0
      ? canal.categoriasPermitidas
      : [NICHO_GERAL];

  const candidatos = await produtosRepo.listarPorNichos(nichosAceitos, "capturado");

  for (const produto of candidatos) {
    const desconto = calcularDesconto(produto.precoOriginal, produto.precoPromocional);
    if (desconto >= canal.descontoMinimo) return produto;
  }

  return null;
}

export async function dispararParaCanal(produtoId: number, canalId: number): Promise<void> {
  const produto = await produtosRepo.buscarPorId(produtoId);
  if (!produto) throw new Error(`Produto ${produtoId} não encontrado`);

  const canal = await canaisRepo.buscarPorId(canalId);
  if (!canal) throw new Error(`Canal ${canalId} não encontrado`);

  if (canal.tipo !== "telegram" && canal.tipo !== "whatsapp") {
    throw new Error(`Envio para canais do tipo "${canal.tipo}" ainda não implementado`);
  }
  if (!produto.titulo || !produto.imagemUrl) {
    // Condição permanente — nada preenche título/imagem depois da captura,
    // então retentar nunca vai funcionar. Marca "falhou" na hora (não espera
    // LIMITE_FALHAS) pra não travar a fila atrás de um produto que nunca vai
    // conseguir ser disparado (mesmo bug do produto rejeitado pelo programa
    // de afiliados, causa raiz diferente — aqui o `throw` acontece antes do
    // try/catch que registra falha em disparos, então nunca contava).
    await produtosRepo.atualizarStatus(produtoId, "falhou");
    throw new Error("Produto sem título ou imagem, não é possível disparar — marcado como falhou");
  }

  let chamada = produto.chamada ?? undefined;
  if (!chamada && (await configuracoesRepo.obterChamadaIAAtiva())) {
    try {
      chamada = await gerarChamada(produto.titulo);
      await produtosRepo.atualizarChamada(produtoId, chamada);
    } catch (err) {
      logger.warn({ err, produtoId }, "falha ao gerar chamada via Ollama, seguindo sem ela");
    }
  }

  try {
    // `produto.fonte` é só rastreio de origem da captura ("mercado_livre" vs
    // "telegram_terceiros", usado pra furar fila — ver listarPorNichos), não
    // é a plataforma do link de afiliado. Hoje toda fonte é produto do ML
    // (telegram_terceiros só aceita link mercadolivre.com.br/meli.la, ver
    // parsearProdutoCard.ts), então a plataforma do gerador é sempre esta.
    const linkAfiliado = await gerarLinkAfiliado("mercado_livre", produto.urlOriginal);
    const legenda = gerarLegenda({
      titulo: produto.titulo,
      chamada,
      precoOriginal: produto.precoOriginal ?? undefined,
      precoPromocional: produto.precoPromocional ?? undefined,
      cupom: produto.cupom ?? undefined,
      precoNoPix: produto.precoNoPix,
      linkAfiliado,
    });

    const enviar = canal.tipo === "telegram" ? enviarFotoTelegram : enviarFotoWhatsapp;
    await enviar(produto.imagemUrl, legenda, canal.identificadorGrupo);

    await disparosRepo.registrar(produtoId, canalId, "enviado");
    await produtosRepo.atualizarStatus(produtoId, "enviado", linkAfiliado);
  } catch (err) {
    await disparosRepo.registrar(produtoId, canalId, "falhou");

    const falhas = await disparosRepo.contarFalhas(produtoId);
    if (falhas >= LIMITE_FALHAS) {
      await produtosRepo.atualizarStatus(produtoId, "falhou");
      logger.warn(
        { produtoId, falhas },
        "produto desistido após falhas repetidas — não bloqueia mais a fila de disparo",
      );
    }

    throw err;
  }
}
