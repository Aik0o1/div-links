export interface CupomExtraido {
  codigo: string;
  percentual: number | null;
  valorFixo: number | null;
  minimo: number | null;
  /**
   * Teto do desconto ("10% OFF limitado a R$10" = no máximo R$10 de
   * desconto) — diferente de `minimo` (compra mínima pra ativar o cupom,
   * "XX% OFF em R$Y+"). Semântica oposta, não pode ir no mesmo campo.
   */
  limiteDesconto: number | null;
}

// Formato A — observado no primeiro grupo monitorado (Telegram, "cupom
// original"): "🎟️/🚨 CODIGO 👉 XX% OFF" numa linha, com "(Min. R$ YY)" em
// uma das linhas seguintes (às vezes ausente).
const REGEX_FORMATO_A = /([A-Z][A-Z0-9]{2,19})\s*👉\s*(\d{1,3})\s*%\s*OFF/;
const REGEX_MINIMO_A = /Min\.\s*R\$\s*([\d.,]+)/i;

// Formato B — observado em outro grupo monitorado (WhatsApp, "REI DA
// PROMO"): "cupom: CODIGO" numa linha (sem 👉), com "R$X OFF em R$Y+" (ou
// "XX% OFF em R$Y+") na linha seguinte. É o mesmo template que o usuário
// pediu originalmente pra legenda de saída (ver formatarLegendaCupons) —
// faz sentido, é um formato comum entre grupos de afiliado do ML.
const REGEX_FORMATO_B_CODIGO = /cupom:?\s*\*?([A-Z0-9]{3,20})\*?/i;
const REGEX_FORMATO_B_VALOR_FIXO = /R\$\s*([\d.,]+)\s*OFF\s*em\s*R\$\s*([\d.,]+)\+/i;
const REGEX_FORMATO_B_PERCENTUAL = /(\d{1,3})\s*%\s*OFF\s*em\s*R\$\s*([\d.,]+)\+/i;
// Variante com teto de desconto em vez de compra mínima: "10% OFF limitado
// a R$10" — sem "em"/sem "+" no final, significado oposto de minimo (ver
// comentário em CupomExtraido).
const REGEX_FORMATO_B_PERCENTUAL_LIMITADO = /(\d{1,3})\s*%\s*OFF\s*limitado\s*a\s*R\$\s*([\d.,]+)/i;

// Formato C — vários cupons (um por categoria), todos com o MESMO percentual
// e a MESMA compra mínima, ditos uma única vez no cabeçalho/rodapé da
// mensagem em vez de repetidos por cupom: "🎟️ CUPOM DE 25% OFF..." no topo,
// depois uma linha por categoria "🏠 Casa e Decoração 🎟️ 👉 USAESSAPROMO"
// (código depois da seta, sem percentual na própria linha), e
// "(Min. R$ 19) Cupons disponíveis..." no fim valendo pra todos.
const REGEX_HEADER_PERCENTUAL_COMPARTILHADO = /CUPOM\s+DE\s+(\d{1,3})\s*%\s*OFF/i;
const REGEX_CODIGO_APOS_SETA = /🎟️?\s*👉\s*([A-Z0-9]{3,20})/;

function paraNumero(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", "."));
}

export function extrairCupons(texto: string): CupomExtraido[] {
  const linhas = texto.split("\n");
  const resultado: CupomExtraido[] = [];
  const codigosVistos = new Set<string>();

  // Formato C é compartilhado pra mensagem inteira — calcula uma vez só,
  // fora do loop por linha (ver comentário acima de REGEX_HEADER_PERCENTUAL_COMPARTILHADO).
  const matchHeaderC = texto.match(REGEX_HEADER_PERCENTUAL_COMPARTILHADO);
  const matchMinimoC = texto.match(REGEX_MINIMO_A);
  const percentualCompartilhado = matchHeaderC ? Number(matchHeaderC[1]) : null;
  const minimoCompartilhado = matchMinimoC ? paraNumero(matchMinimoC[1]) : null;

  for (let i = 0; i < linhas.length; i++) {
    const matchA = linhas[i].match(REGEX_FORMATO_A);
    if (matchA) {
      const codigo = matchA[1];
      if (codigosVistos.has(codigo)) continue;

      let minimo: number | null = null;
      for (let j = i; j < Math.min(i + 4, linhas.length); j++) {
        if (j > i && REGEX_FORMATO_A.test(linhas[j])) break; // já entrou no próximo cupom
        const matchMinimo = linhas[j].match(REGEX_MINIMO_A);
        if (matchMinimo) {
          minimo = paraNumero(matchMinimo[1]);
          break;
        }
      }

      resultado.push({ codigo, percentual: Number(matchA[2]), valorFixo: null, minimo, limiteDesconto: null });
      codigosVistos.add(codigo);
      continue;
    }

    const matchCodigoB = linhas[i].match(REGEX_FORMATO_B_CODIGO);
    if (matchCodigoB) {
      const codigo = matchCodigoB[1].toUpperCase();
      if (codigosVistos.has(codigo)) continue;

      for (let j = i; j < Math.min(i + 3, linhas.length); j++) {
        const matchValorFixo = linhas[j].match(REGEX_FORMATO_B_VALOR_FIXO);
        if (matchValorFixo) {
          resultado.push({
            codigo,
            percentual: null,
            valorFixo: paraNumero(matchValorFixo[1]),
            minimo: paraNumero(matchValorFixo[2]),
            limiteDesconto: null,
          });
          codigosVistos.add(codigo);
          break;
        }
        const matchPercentual = linhas[j].match(REGEX_FORMATO_B_PERCENTUAL);
        if (matchPercentual) {
          resultado.push({
            codigo,
            percentual: Number(matchPercentual[1]),
            valorFixo: null,
            minimo: paraNumero(matchPercentual[2]),
            limiteDesconto: null,
          });
          codigosVistos.add(codigo);
          break;
        }
        const matchPercentualLimitado = linhas[j].match(REGEX_FORMATO_B_PERCENTUAL_LIMITADO);
        if (matchPercentualLimitado) {
          resultado.push({
            codigo,
            percentual: Number(matchPercentualLimitado[1]),
            valorFixo: null,
            minimo: null,
            limiteDesconto: paraNumero(matchPercentualLimitado[2]),
          });
          codigosVistos.add(codigo);
          break;
        }
      }
      // Se não achou linha de desconto nas próximas linhas, não é um cupom
      // de lista de verdade (provavelmente é o cupom de um card de produto
      // único, ver parsearProdutoCard.ts) — não adiciona nada.
      continue;
    }

    // Formato C — só entra se achou o percentual compartilhado no cabeçalho
    // (sem ele não dá pra saber o desconto desse código, e "undefined% OFF"
    // na legenda de saída ficaria errado — melhor não adicionar do que
    // adicionar errado).
    if (percentualCompartilhado !== null) {
      const matchSeta = linhas[i].match(REGEX_CODIGO_APOS_SETA);
      if (matchSeta) {
        const codigo = matchSeta[1].toUpperCase();
        if (!codigosVistos.has(codigo)) {
          resultado.push({
            codigo,
            percentual: percentualCompartilhado,
            valorFixo: null,
            minimo: minimoCompartilhado,
            limiteDesconto: null,
          });
          codigosVistos.add(codigo);
        }
      }
    }
  }

  return resultado;
}

export function formatarLegendaCupons(cupons: CupomExtraido[], linkFixo: string): string {
  const linhas: string[] = ["*NOVOS CUPONS MERCADO LIVRE*", ""];

  for (const cupom of cupons) {
    linhas.push(`⚠️ cupom: ${cupom.codigo} 🎫`);
    if (cupom.valorFixo !== null) {
      linhas.push(
        cupom.minimo !== null ? `R$${cupom.valorFixo} OFF em R$${cupom.minimo}+` : `R$${cupom.valorFixo} OFF`,
      );
    } else if (cupom.limiteDesconto !== null) {
      linhas.push(`${cupom.percentual}% OFF limitado a R$${cupom.limiteDesconto}`);
    } else {
      linhas.push(
        cupom.minimo !== null ? `${cupom.percentual}% OFF em R$${cupom.minimo}+` : `${cupom.percentual}% OFF`,
      );
    }
    linhas.push("");
  }

  linhas.push("Ative o cupom aqui e use no produto desejado");
  linhas.push(linkFixo);

  return linhas.join("\n");
}
