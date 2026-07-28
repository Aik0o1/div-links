// "253 reais com 80 centavos" / "Antes: 499 reais com 90 centavos" -> 253.8 / 499.9
//
// Também aceita a variante em espanhol ("104 reales con 90 centavos") — o
// ML às vezes renderiza o aria-label nesse idioma mesmo em mercadolivre.com.br
// (raspagem real: 100% dos preços de uma captura vieram assim, causa exata
// não confirmada — cookies/navigator.language do Chrome pareciam normais em
// pt-BR). Sem esse fallback, o preço inteiro é perdido silenciosamente
// (produto vai pro disparo sem preço nenhum).
const REGEX_PRECO = /(\d+)\s*rea(?:is|les)(?:\s*(?:com|con)\s*(\d+)\s*centavos?)?/i;

export function parsePreco(texto: string | null | undefined): number | undefined {
  if (!texto) return undefined;
  const match = texto.match(REGEX_PRECO);
  if (!match) return undefined;
  const centavos = match[2] ? Number(match[2]) : 0;
  return Number(match[1]) + centavos / 100;
}
