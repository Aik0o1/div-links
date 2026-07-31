export type PlataformaCupom = "shopee" | "mercado_livre" | "aliexpress" | "amazon" | "magalu" | "desconhecida";

const REGEX_URL_GENERICA = /(https?:\/\/[^\s]+)/g;

// Domínio real de cada marketplace, na ordem em que são checados — usado só
// pra IDENTIFICAR de qual site é o link (rotular certo, ver comentário
// abaixo). Não significa que o sistema sabe gerar link de afiliado ou
// despachar automaticamente pra todos eles (só Shopee e Mercado Livre têm
// isso hoje, ver dispararCupomPendente em repassarCupons.ts).
const DOMINIOS_PLATAFORMA: { plataforma: PlataformaCupom; padroes: string[] }[] = [
  { plataforma: "shopee", padroes: ["shopee.com", "shope.ee"] },
  { plataforma: "mercado_livre", padroes: ["mercadolivre.com", "mercadolibre.com", "meli.la"] },
  { plataforma: "aliexpress", padroes: ["aliexpress.com"] },
  { plataforma: "amazon", padroes: ["amazon.com", "amzn.to", "link.amazon"] },
  { plataforma: "magalu", padroes: ["magazineluiza", "magazinevoce", "amzlink.to"] },
];

/**
 * Detecta de qual marketplace veio o cupom pelo link no texto — o mesmo
 * grupo monitorado às vezes mistura cupom de vários sites, e antes disso
 * QUALQUER link que não fosse da Shopee virava "Mercado Livre" por padrão
 * (bug real relatado pelo usuário: cupom do AliExpress rotulado e tratado
 * como se fosse do ML). Link de site não reconhecido vira "desconhecida" —
 * nunca é despachado automaticamente (ver dispararCupomPendente), só fica
 * capturado e visível na aba Cupons, em vez de sair rotulado/tratado errado.
 * Sem link nenhum no texto, mantém o comportamento histórico (assume
 * Mercado Livre — formato mais comum nesses grupos quando não tem link).
 */
export function detectarPlataformaCupom(texto: string): { plataforma: PlataformaCupom; urlShopee: string | null } {
  const urls = texto.match(REGEX_URL_GENERICA) ?? [];

  for (const { plataforma, padroes } of DOMINIOS_PLATAFORMA) {
    const encontrada = urls.find((u) => padroes.some((p) => u.toLowerCase().includes(p)));
    if (encontrada) {
      return {
        plataforma,
        urlShopee: plataforma === "shopee" ? encontrada.replace(/[.,;!?)\]]+$/, "") : null,
      };
    }
  }

  if (urls.length > 0) return { plataforma: "desconhecida", urlShopee: null };
  return { plataforma: "mercado_livre", urlShopee: null };
}

export interface CupomExtraido {
  /**
   * null quando é um voucher sem código pra digitar — comum na Shopee, um
   * único link já ativa um lote de faixas de desconto ("Resgate os cupons
   * aqui" + 1 link só, ver pareceDescricaoDeDesconto/Formato D). Nesse caso
   * a descrição crua vem em `descricaoLivre`, os campos estruturados abaixo
   * não se aplicam.
   */
  codigo: string | null;
  percentual: number | null;
  valorFixo: number | null;
  minimo: number | null;
  /**
   * Teto do desconto ("10% OFF limitado a R$10" = no máximo R$10 de
   * desconto) — diferente de `minimo` (compra mínima pra ativar o cupom,
   * "XX% OFF em R$Y+"). Semântica oposta, não pode ir no mesmo campo.
   */
  limiteDesconto: number | null;
  /** Só preenchido no voucher sem código (Formato D) — ver comentário em `codigo`. */
  descricaoLivre?: string;
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

// Formato D — comum na Shopee: várias faixas de desconto SEM código nenhum
// pra digitar, um único link no fim já resgata o lote inteiro de uma vez
// ("Resgate os cupons aqui" + 1 link). Cada linha começando com 🎟️ que
// menciona desconto ("OFF" + "%" ou "R$" em qualquer ordem/distância — ex.:
// "R$10 OFF acima de R$99" tem o valor ENTRE o "R$" e o "OFF", não colado)
// vira um item — mantém a descrição como veio, sem decompor em
// percentual/mínimo estruturados (o texto varia demais: "limitado a R$20
// FULL", "acima de R$99" etc.). Só entra se nenhum dos formatos com código
// (A/B/C) achou nada nessa mensagem.
const REGEX_TICKET_PREFIXO = /^🎟️?\s*(.+)$/;
function pareceDescricaoDeDesconto(texto: string): boolean {
  return /OFF/i.test(texto) && (texto.includes("%") || /R\$/i.test(texto));
}

function paraNumero(texto: string): number {
  return Number(texto.replace(/\./g, "").replace(",", "."));
}

function ehLinhaCodigoBValido(linha: string): boolean {
  const match = linha.match(REGEX_FORMATO_B_CODIGO);
  return !!match && /^[A-Z0-9]+$/.test(match[1]);
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
    // REGEX_FORMATO_B_CODIGO é case-insensitive só pro rótulo ("Cupom:"/"cupom:")
    // — o CÓDIGO em si precisa estar em maiúsculas no texto original, senão
    // qualquer palavra normal logo depois de "cupom" vira "código" por engano
    // (bug real: "Cupom Shopee Exclusivo de 15% OFF..." capturou "Shopee"
    // como se fosse o código e mandou um cupom "SHOPEE" inexistente pro
    // canal — mesma classe de bug já corrigida no Formato A, que nunca teve
    // essa checagem no Formato B).
    if (matchCodigoB && /^[A-Z0-9]+$/.test(matchCodigoB[1])) {
      const codigo = matchCodigoB[1];
      if (codigosVistos.has(codigo)) continue;

      for (let j = i; j < Math.min(i + 3, linhas.length); j++) {
        // Sem isso, um "cupom:" que não tem desconto na própria janela (ex.:
        // um cabeçalho tipo "*NOVO CUPOM SHOPEE*", que também casa com esse
        // regex por acidente) podia continuar procurando e "roubar" a linha
        // de desconto que na verdade pertence ao PRÓXIMO cupom real da
        // mensagem — mesmo bug de vazamento que o Formato A já evitava.
        if (j > i && ehLinhaCodigoBValido(linhas[j])) break;
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

  // Formato D só entra se A/B/C não acharam nenhum cupom com código nessa
  // mensagem (ver comentário acima da função pareceDescricaoDeDesconto).
  if (resultado.length === 0) {
    const candidatosD: CupomExtraido[] = [];
    const descricoesVistas = new Set<string>();
    for (const linha of linhas) {
      const matchTicket = linha.trim().match(REGEX_TICKET_PREFIXO);
      if (!matchTicket) continue;
      const descricaoLivre = matchTicket[1].trim();
      if (!pareceDescricaoDeDesconto(descricaoLivre)) continue;
      if (descricoesVistas.has(descricaoLivre)) continue;
      candidatosD.push({ codigo: null, percentual: null, valorFixo: null, minimo: null, limiteDesconto: null, descricaoLivre });
      descricoesVistas.add(descricaoLivre);
    }
    // Só conta como "lista de cupons" de verdade com 2+ faixas — uma linha
    // só de "🎟️ ... OFF" é comum também num post de PRODUTO único com cupom
    // embutido (ver parsearProdutoCardShopee.ts), que tem que continuar
    // caindo no fluxo de produto (com título/preço/imagem/link do produto),
    // não virar uma "lista de cupons" genérica sem nada disso. Bug real:
    // post de "Capa De Chuva..." com 1 cupom foi engolido aqui, perdendo o
    // produto inteiro.
    if (candidatosD.length >= 2) {
      resultado.push(...candidatosD);
    }
  }

  return resultado;
}

export function formatarLegendaCupons(
  cupons: CupomExtraido[],
  link: string,
  plataforma: PlataformaCupom = "mercado_livre",
): string {
  const titulo = plataforma === "shopee" ? "*NOVOS CUPONS SHOPEE*" : "*NOVOS CUPONS MERCADO LIVRE*";
  const linhas: string[] = [titulo, ""];

  for (const cupom of cupons) {
    if (cupom.codigo === null) {
      // Formato D (voucher sem código) — só a descrição, sem linha de
      // "cupom: X" (não existe código nenhum pra mostrar).
      linhas.push(`🎟️ ${cupom.descricaoLivre}`, "");
      continue;
    }
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
  linhas.push(link);

  return linhas.join("\n");
}
