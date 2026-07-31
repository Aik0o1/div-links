import * as produtosRepo from "../repositorios/produtos.js";
import {
  resolverUrlFinal,
  buscarDadosProduto,
  buscarProdutoEmPerfilSocial,
} from "../integracoes/mercadoLivre/produtoScraper.js";
import { extrairPrecos, chamadaSemRepetirTitulo } from "./parsearProdutoCard.js";
import { logger } from "../config/logger.js";

export type OrigemGrupoMonitorado = "telegram" | "whatsapp";

/**
 * Recebe um link (possivelmente encurtado) achado numa mensagem de grupo
 * monitorado + um cupom opcional já extraído do texto, resolve o link,
 * busca os dados reais na página do produto (nunca confia no texto/imagem
 * do post) e captura como produto — igual a um produto vindo da captura do
 * ML, cai em `produtos` com status "capturado" e é pego pelo disparo
 * automático já existente (não dispara nada aqui diretamente).
 *
 * `origem` vira o `fonte` do produto (`telegram_terceiros` / `whatsapp_terceiros`).
 * `nicho` vem da configuração do grupo monitorado (aba Status) — cada grupo
 * pode mandar produto pra um nicho diferente (ex.: grupo de perfume ->
 * nicho "perfumes"), não é mais fixo em "geral".
 * `textoOriginal` é usado só no fallback de perfil social (ver abaixo).
 */
export async function processarProdutoDetectado(
  urlBruta: string,
  cupom: string | null,
  chamada: string | null,
  origem: OrigemGrupoMonitorado,
  nicho: string,
  textoOriginal: string,
  grupoId?: string,
): Promise<void> {
  try {
    const urlResolvida = await resolverUrlFinal(urlBruta);
    let dados = await buscarDadosProduto(urlResolvida);
    let urlFinalProduto = urlResolvida;

    if (!dados) {
      // Link de afiliado (meli.la) do "Gerador de produtos recomendados" não
      // aponta pro produto — resolve pro perfil social de quem postou, com o
      // produto original em destaque (ver buscarProdutoEmPerfilSocial).
      const urlAchada = await buscarProdutoEmPerfilSocial(urlResolvida);
      if (urlAchada) {
        dados = await buscarDadosProduto(urlAchada);
        if (dados) urlFinalProduto = urlAchada;
      }
    }

    if (!dados) {
      logger.debug(
        { urlBruta, urlResolvida },
        "link de grupo monitorado não é uma página de produto ML reconhecível (nem direto, nem via perfil social), ignorado",
      );
      return;
    }

    // Preço: usa o valor anunciado no próprio post do grupo monitorado
    // quando disponível (pedido do usuário — evita divergir do que a
    // audiência já viu), com o preço raspado da página real como fallback
    // pros casos em que o post não menciona valor. Título e imagem sempre
    // vêm da página real (ver comentário em extrairProdutoCard).
    const precosDoPost = extrairPrecos(textoOriginal);
    const precoPromocional = precosDoPost ? precosDoPost.precoPromocional : dados.precoPromocional;
    const precoOriginal = precosDoPost?.precoOriginal ?? dados.precoOriginal;

    const resultado = await produtosRepo.inserirSeNovo({
      fonte: origem === "telegram" ? "telegram_terceiros" : "whatsapp_terceiros",
      urlOriginal: urlFinalProduto,
      titulo: dados.titulo,
      precoOriginal,
      precoPromocional,
      imagemUrl: dados.imagemUrl,
      cupom: cupom ?? undefined,
      nicho,
      precoNoPix: precosDoPost?.noPix ?? false,
      grupoOrigemId: grupoId,
      chamada: chamadaSemRepetirTitulo(chamada, dados.titulo) ?? undefined,
    });

    if (resultado) {
      logger.info(
        { produtoId: resultado.id, titulo: resultado.titulo, cupom, nicho },
        "produto de grupo monitorado capturado — entra na fila do disparo automático",
      );
    } else {
      logger.debug({ urlFinalProduto }, "produto de grupo monitorado já capturado antes, ignorado");
    }
  } catch (err) {
    logger.error({ err, urlBruta }, "falha ao processar produto de grupo monitorado");
  }
}
