import { buscarOfertasMercadoLivre } from "../integracoes/mercadoLivre/ofertasScraperHttp.js";
import * as nichosRepo from "../repositorios/nichos.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import * as produtosRepo from "../repositorios/produtos.js";
import { calcularDesconto } from "./calcularDesconto.js";
import { logger } from "../config/logger.js";
import type { ProdutoBruto } from "../types/produto.js";
import type { NichoRow } from "../repositorios/nichos.js";

// Por categoria (cada categoria já é rica o bastante, ex: Beleza tem 700+ produtos em oferta).
const PAGINAS_POR_CATEGORIA = 2;

// Nicho "geral" (sem categoria) mira em 400+ produtos; cada página tem ~36-40.
const PAGINAS_NICHO_GERAL = 12;

export interface ResultadoCaptura {
  novos: number;
  duplicados: number;
  ignorados: number;
  total: number;
}

async function processarOfertas(
  usuarioId: number,
  ofertas: ProdutoBruto[],
  nichoId: string,
  descontoMinimo: number,
  contadores: { novos: number; duplicados: number; ignorados: number },
): Promise<void> {
  for (const oferta of ofertas) {
    const dados = oferta.dadosEstruturados;
    if (!dados?.titulo || !dados.imagemUrl) {
      contadores.ignorados++;
      continue;
    }

    const desconto = calcularDesconto(dados.precoOriginal, dados.precoPromocional);
    if (desconto < descontoMinimo) {
      contadores.ignorados++;
      continue;
    }

    const resultado = await produtosRepo.inserirSeNovo(usuarioId, {
      fonte: oferta.fonte,
      urlOriginal: oferta.urlOriginal,
      titulo: dados.titulo,
      precoOriginal: dados.precoOriginal,
      precoPromocional: dados.precoPromocional,
      imagemUrl: dados.imagemUrl,
      cupom: dados.cupom,
      nicho: nichoId,
    });

    if (resultado) contadores.novos++;
    else contadores.duplicados++;
  }
}

/**
 * Captura um nicho só — reusada tanto pelo "capturar tudo" (loop em todos os
 * nichos ativos) quanto pela captura por aba (um nicho específico). Muta
 * `contadores` por referência (mesmo objeto em toda a chamada, pra agregação
 * ficar correta quando chamada várias vezes em loop).
 */
async function capturarNichoML(
  usuarioId: number,
  nicho: NichoRow,
  descontoMinimo: number,
  contadores: { novos: number; duplicados: number; ignorados: number },
): Promise<void> {
  if (nicho.categoriaIds.length === 0) {
    // Nicho sem categoria (ex.: "geral") -> busca a aba de Ofertas sem filtro, com mais páginas.
    const ofertas = await buscarOfertasMercadoLivre(usuarioId, PAGINAS_NICHO_GERAL);
    await processarOfertas(usuarioId, ofertas, nicho.id, descontoMinimo, contadores);
    return;
  }

  for (const categoriaId of nicho.categoriaIds) {
    const ofertas = await buscarOfertasMercadoLivre(usuarioId, PAGINAS_POR_CATEGORIA, categoriaId);
    await processarOfertas(usuarioId, ofertas, nicho.id, descontoMinimo, contadores);
  }
}

/**
 * Captura TODOS os nichos ativos de uma vez, zerando a tabela inteira antes
 * (inclusive produto já enviado — histórico de disparos vai junto, ON DELETE
 * CASCADE — decisão explícita do usuário: cada captura é uma leva nova do
 * zero). Usada pelo `npm run capturar` (CLI) e mantida como está — a captura
 * por aba (abaixo) é escopada, não passa por aqui.
 */
export async function capturarProdutos(usuarioId: number): Promise<ResultadoCaptura> {
  const nichos = await nichosRepo.ativos(usuarioId);
  const descontoMinimo = await configuracoesRepo.obterDescontoMinimo(usuarioId);

  await produtosRepo.removerTodos(usuarioId);

  const contadores = { novos: 0, duplicados: 0, ignorados: 0 };
  for (const nicho of nichos) {
    await capturarNichoML(usuarioId, nicho, descontoMinimo, contadores);
  }

  logger.info({ usuarioId, ...contadores }, "captura concluída (por categoria + geral)");
  return { ...contadores, total: contadores.novos + contadores.duplicados + contadores.ignorados };
}

/**
 * Captura só UM nicho (aba Produtos) — zera só os produtos daquele nicho +
 * fonte ML antes de recapturar (não mexe em outros nichos nem na Shopee).
 */
export async function capturarProdutosPorNicho(usuarioId: number, nichoId: string): Promise<ResultadoCaptura> {
  const nicho = await nichosRepo.buscarPorId(usuarioId, nichoId);
  if (!nicho || !nicho.ativo) {
    throw new Error(`Nicho "${nichoId}" não encontrado ou inativo`);
  }

  const descontoMinimo = await configuracoesRepo.obterDescontoMinimo(usuarioId);
  await produtosRepo.removerPorNichoEFonte(usuarioId, nichoId, "mercado_livre");

  const contadores = { novos: 0, duplicados: 0, ignorados: 0 };
  await capturarNichoML(usuarioId, nicho, descontoMinimo, contadores);

  logger.info({ usuarioId, nicho: nichoId, ...contadores }, "captura por nicho concluída (Mercado Livre)");
  return { ...contadores, total: contadores.novos + contadores.duplicados + contadores.ignorados };
}
