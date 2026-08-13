import * as produtosRepo from "../repositorios/produtos.js";
import {
  resolverUrlFinal,
  buscarDadosProduto,
  buscarProdutoEmPerfilSocial,
} from "../integracoes/mercadoLivre/produtoScraperHttp.js";
import { logger } from "../config/logger.js";
import type { ProdutoRow } from "../repositorios/produtos.js";

export interface CapturaManualEntrada {
  /** Link já com afiliação (ex.: meli.la/... gerado pelo próprio usuário) — usado direto, sem gerar de novo no disparo. */
  url: string;
  cupom?: string;
  /** Preço final informado por quem está capturando (ex.: já com cupom aplicado) — vira o "Por:" da legenda. */
  precoPromocional?: number;
  precoNoPix?: boolean;
  nicho: string;
}

/**
 * Captura avulsa de um produto específico, disparada manualmente (aba
 * Produtos do painel, ou o usuário passando um link direto) — complementa a
 * captura em massa por nicho (capturarProdutos.ts) e a de grupo monitorado
 * (capturarProdutoTerceiro.ts) pro caso "achei uma oferta e quero add na
 * fila na hora".
 *
 * Título e imagem sempre vêm da página real do produto (nunca do que quem
 * capturou disse) — mesmo princípio das outras duas capturas. Preço
 * original ("De:") também vem sempre da página real (ver mesmo raciocínio
 * em capturarProdutoTerceiro.ts). `precoPromocional` é o único dado que
 * vem de quem capturou, já que pode refletir cupom/desconto que não
 * aparece na página pra quem não é o dono do link.
 *
 * `url` pode já ser um link de afiliado (meli.la) — nesse caso é usado
 * direto como `urlAfiliado` no produto, pulando geração no disparo (ver
 * dispararProduto.ts: `produto.urlAfiliado ?? gerarLinkAfiliado(...)`).
 */
export async function capturarProdutoManual(entrada: CapturaManualEntrada): Promise<ProdutoRow | null> {
  const urlResolvida = await resolverUrlFinal(entrada.url);
  let dados = await buscarDadosProduto(urlResolvida);
  let urlFinalProduto = urlResolvida;

  if (!dados) {
    const urlAchada = await buscarProdutoEmPerfilSocial(urlResolvida);
    if (urlAchada) {
      dados = await buscarDadosProduto(urlAchada);
      if (dados) urlFinalProduto = urlAchada;
    }
  }

  if (!dados) {
    throw new Error(`"${entrada.url}" não resolveu pra uma página de produto ML reconhecível`);
  }

  const resultado = await produtosRepo.inserirSeNovo({
    fonte: "mercado_livre",
    urlOriginal: urlFinalProduto,
    urlAfiliado: entrada.url,
    titulo: dados.titulo,
    precoOriginal: dados.precoOriginal,
    precoPromocional: entrada.precoPromocional ?? dados.precoPromocional,
    imagemUrl: dados.imagemUrl,
    cupom: entrada.cupom,
    nicho: entrada.nicho,
    precoNoPix: entrada.precoNoPix ?? false,
  });

  if (resultado) {
    logger.info(
      { produtoId: resultado.id, titulo: resultado.titulo, cupom: entrada.cupom, nicho: entrada.nicho },
      "produto capturado manualmente — entra na fila do disparo automático",
    );
  }

  return resultado;
}
