export function calcularDesconto(
  original: number | null | undefined,
  promocional: number | null | undefined,
): number {
  if (!original || !promocional || original <= promocional) return 0;
  return Math.round((1 - promocional / original) * 100);
}
