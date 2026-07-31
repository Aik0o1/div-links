/**
 * A Shopee não tem um equivalente confiável ao "category=MLB..." do Mercado
 * Livre — o filtro `productCatId` da API existe, mas são milhares de
 * subcategorias-folha sem nenhuma lista oficial navegável (confirmado via
 * introspecção + amostragem real: um único termo genérico pode ter 200+ IDs
 * diferentes, e não há endpoint que devolva a árvore). Curar isso com
 * confiança não é viável.
 *
 * Em vez disso, cada nicho usa uma lista de termos de busca (`keyword` do
 * `productOfferV2`) testados manualmente contra a API real — termos
 * genéricos de uma palavra são ruidosos ("smartphone", "panela", "cozinha"
 * devolvem muito produto fora do tema), frases específicas de 2-3 palavras
 * são consistentemente precisas ("mouse gamer", "capinha de celular",
 * "fone de ouvido bluetooth"). Fixo no código, não editável pela UI —
 * mesma decisão de esconder os IDs do ML do usuário.
 *
 * "geral" não entra aqui: continua usando a busca sem filtro (catálogo
 * amplo), igual antes.
 */
export const NICHO_SHOPEE_KEYWORDS: Record<string, string[]> = {
  beleza: ["maquiagem", "perfume feminino", "skincare facial", "batom"],
  casa: ["organizador de cozinha", "jogo de panelas", "airfryer", "decoração para casa"],
  gamer: ["mouse gamer", "cadeira gamer", "teclado gamer", "headset gamer"],
  moda: ["tenis feminino", "camiseta masculina", "bolsa feminina", "roupa infantil"],
  tecnologia: ["fone de ouvido bluetooth", "capinha de celular", "carregador turbo", "smartwatch"],
  maternidade: ["roupa de bebe", "enxoval de bebe", "fralda descartavel", "kit maternidade"],
  pet: ["racao para cachorro", "brinquedo para gato", "coleira para cachorro", "casinha de cachorro", "areia higienica para gato"],
};
