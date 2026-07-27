import { buscarOfertasMercadoLivre } from "../integracoes/mercadoLivre/ofertasScraper.js";
import * as nichosRepo from "../repositorios/nichos.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import * as produtosRepo from "../repositorios/produtos.js";
import { calcularDesconto } from "./calcularDesconto.js";
import { logger } from "../config/logger.js";
import type { ProdutoBruto } from "../types/produto.js";

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

    const resultado = await produtosRepo.inserirSeNovo({
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

export async function capturarProdutos(): Promise<ResultadoCaptura> {
  const nichos = await nichosRepo.ativos();
  const descontoMinimo = await configuracoesRepo.obterDescontoMinimo();

  // Zera a tabela inteira a cada captura — inclusive produtos já enviados
  // (o histórico de disparos vai junto, por ON DELETE CASCADE). Decisão
  // explícita do usuário: cada captura é uma leva nova do zero.
  await produtosRepo.removerTodos();

  const contadores = { novos: 0, duplicados: 0, ignorados: 0 };

  for (const nicho of nichos) {
    if (nicho.categoriaIds.length === 0) {
      // Nicho sem categoria (ex.: "geral") -> busca a aba de Ofertas sem filtro, com mais páginas.
      const ofertas = await buscarOfertasMercadoLivre(PAGINAS_NICHO_GERAL);
      await processarOfertas(ofertas, nicho.id, descontoMinimo, contadores);
      continue;
    }

    for (const categoriaId of nicho.categoriaIds) {
      const ofertas = await buscarOfertasMercadoLivre(PAGINAS_POR_CATEGORIA, categoriaId);
      await processarOfertas(ofertas, nicho.id, descontoMinimo, contadores);
    }
  }

  logger.info(contadores, "captura concluída (por categoria + geral)");
  return { ...contadores, total: contadores.novos + contadores.duplicados + contadores.ignorados };
}
