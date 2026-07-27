// "253 reais com 80 centavos" / "Antes: 499 reais com 90 centavos" -> 253.8 / 499.9
export function parsePreco(texto: string | null | undefined): number | undefined {
  if (!texto) return undefined;
  const match = texto.match(/(\d+)\s*reais(?:\s*com\s*(\d+)\s*centavos?)?/i);
  if (!match) return undefined;
  const centavos = match[2] ? Number(match[2]) : 0;
  return Number(match[1]) + centavos / 100;
}
