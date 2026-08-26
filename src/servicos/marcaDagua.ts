import * as assinaturasRepo from "../repositorios/assinaturas.js";

// Sem link de site pra incluir ainda (o produto não tem página pública
// própria) — só o nome, por enquanto. Adicionar o link aqui assim que
// existir.
const TEXTO_MARCA_DAGUA = "\n\nEnviado com PromoFlow";

/**
 * Toda mensagem despachada (produto ou cupom) durante o período de teste
 * grátis leva essa marca — some sozinha assim que a conta vira uma
 * assinatura paga de verdade (status deixa de ser "trial"). Incentivo pra
 * assinar: divulgação de graça pro PromoFlow em todo grupo que recebe
 * produto de uma conta ainda não paga.
 */
export async function comMarcaDaguaSeTrial(usuarioId: number, legenda: string): Promise<string> {
  const assinatura = await assinaturasRepo.buscarPorUsuarioId(usuarioId);
  return assinatura?.status === "trial" ? `${legenda}${TEXTO_MARCA_DAGUA}` : legenda;
}
