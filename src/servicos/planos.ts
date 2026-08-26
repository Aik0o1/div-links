// Lista fixa em código, não tabela — mesmo espírito de seedNichosPadrao.ts.
// Mudar preço/limite aqui não afeta assinatura já criada no Mercado Pago
// (preapproval guarda o valor no momento da criação); só vale pra checkout
// novo.
export const PLANOS = {
  basico: { nome: "Básico", precoCentavos: 5000, limiteCanais: 1, limiteGruposMonitorados: 1 },
  pro: { nome: "Pro", precoCentavos: 10000, limiteCanais: 5, limiteGruposMonitorados: 5 },
  plus: { nome: "Plus", precoCentavos: 15000, limiteCanais: 10, limiteGruposMonitorados: 10 },
} as const;

export type PlanoId = keyof typeof PLANOS;

export function ehPlanoValido(valor: unknown): valor is PlanoId {
  return typeof valor === "string" && valor in PLANOS;
}
