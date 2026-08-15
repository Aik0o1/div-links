import * as produtosRepo from "../repositorios/produtos.js";
import * as canaisRepo from "../repositorios/canais.js";
import * as disparosRepo from "../repositorios/disparos.js";
import * as configuracoesRepo from "../repositorios/configuracoes.js";
import { gerarLinkAfiliado } from "../linkAfiliado/index.js";
import { gerarLegenda } from "../legenda/gerarLegenda.js";
import {
  enviarFotoComLegenda as enviarFotoTelegram,
  enviarFotoLocalComLegenda as enviarFotoLocalTelegram,
} from "../integracoes/telegram/bot.js";
import {
  enviarFotoComLegenda as enviarFotoWhatsapp,
  enviarFotoLocalComLegenda as enviarFotoLocalWhatsapp,
} from "../integracoes/evolutionApi/bot.js";
import { gerarChamada } from "../integracoes/ollama/gerarChamada.js";
import { calcularDesconto } from "./calcularDesconto.js";
import { logger } from "../config/logger.js";
import type { CanalRow } from "../repositorios/canais.js";
import type { ProdutoRow } from "../repositorios/produtos.js";

export interface CanalComElegibilidade extends CanalRow {
  elegivel: boolean;
  motivo?: string;
}

// Depois desse número de falhas, o produto é marcado "falhou" e some da
// fila — sem isso, um produto com falha permanente (ex.: ML rejeita o link
// de afiliado, "Este URL não é permitido pelo Programa") ficava sendo
// retentado pra sempre a cada ciclo (é sempre o mais antigo "capturado",
// então nunca sai da frente da fila) — bloqueando TODOS os produtos atrás
// dele indefinidamente. Bug real: fila inteira travada por ~30min atrás de
// um único produto de categoria não elegível pro programa de afiliados.
const LIMITE_FALHAS = 3;

/** `produto.fonte` diz de qual plataforma é o link original — cada fonte de captura só aceita link daquela plataforma. */
function plataformaAfiliado(fonte: string): string {
  return fonte.includes("shopee") ? "shopee" : "mercado_livre";
}

// Canal sem categorias definidas = "geral" = aceita produto de QUALQUER
// nicho (tecnologia, casa, beleza, shopee...). Só quando o canal define
// categorias específicas é que ele fica restrito só àquelas. Antes, um
// canal "geral" só aceitava produto com nicho literalmente = "geral" —
// excluía por engano todo produto capturado com nicho específico (ex.:
// "tecnologia", "casa"), quase metade do catálogo real.
function nichoElegivel(canal: CanalRow, nichoProduto: string | null): boolean {
  const permitidas = canal.categoriasPermitidas;
  if (permitidas && permitidas.length > 0) {
    return nichoProduto ? permitidas.includes(nichoProduto) : false;
  }
  return true;
}

// Mesma categorização usada no filtro "Origem" da aba Produtos — um canal
// pode restringir de qual dessas o produto precisa vir. "shopee" e
// "monitorados" se sobrepõem de propósito (produto de grupo monitorado da
// Shopee é as duas coisas ao mesmo tempo).
const FONTES_ML = new Set(["mercado_livre", "telegram_terceiros", "whatsapp_terceiros"]);
const FONTES_SHOPEE = new Set(["shopee", "telegram_shopee", "whatsapp_shopee"]);
const FONTES_MONITORADAS = new Set([
  "telegram_terceiros",
  "whatsapp_terceiros",
  "telegram_shopee",
  "whatsapp_shopee",
]);

function pertenceASelecaoFonte(fonteProduto: string, selecao: string): boolean {
  switch (selecao) {
    case "mercado_livre":
      return FONTES_ML.has(fonteProduto);
    case "shopee":
      return FONTES_SHOPEE.has(fonteProduto);
    case "monitorados":
      return FONTES_MONITORADAS.has(fonteProduto);
    default:
      return false;
  }
}

// Canal sem fontes definidas aceita produto de qualquer origem. Com uma ou
// mais selecionadas, só aceita produto vindo delas.
function fonteElegivel(canal: CanalRow, fonteProduto: string): boolean {
  const permitidas = canal.fontesPermitidas;
  if (!permitidas || permitidas.length === 0) return true;
  return permitidas.some((selecao) => pertenceASelecaoFonte(fonteProduto, selecao));
}

/**
 * Allow-list de grupos monitorados específicos do canal — mais granular que
 * fontesPermitidas/categoriasPermitidas (aquelas restringem por categoria
 * genérica de origem, essa por grupo individual). Quando o produto é de um
 * grupo explicitamente permitido, o nicho do canal vira secundário (decisão
 * explícita do usuário) — "bypass_nicho" sinaliza isso pra quem chama pular
 * o nichoElegivel. Produto que não é de grupo monitorado nunca é afetado por
 * essa allow-list, mesmo com ela definida.
 */
function grupoMonitoradoStatus(
  canal: CanalRow,
  produto: Pick<ProdutoRow, "grupoOrigemId">,
): "bypass_nicho" | "bloqueado" | "sem_restricao" {
  const permitidos = canal.gruposMonitoradosPermitidos;
  if (!permitidos || permitidos.length === 0) return "sem_restricao";
  if (!produto.grupoOrigemId) return "sem_restricao";
  return permitidos.includes(produto.grupoOrigemId) ? "bypass_nicho" : "bloqueado";
}

export async function canaisElegiveis(usuarioId: number, produtoId: number): Promise<CanalComElegibilidade[]> {
  const produto = await produtosRepo.buscarPorId(usuarioId, produtoId);
  if (!produto) throw new Error(`Produto ${produtoId} não encontrado`);

  const canais = await canaisRepo.listar(usuarioId);
  const desconto = calcularDesconto(produto.precoOriginal, produto.precoPromocional);

  const resultado: CanalComElegibilidade[] = [];

  for (const canal of canais) {
    if (!canal.ativo) {
      resultado.push({ ...canal, elegivel: false, motivo: "canal desativado" });
      continue;
    }

    // Grupo bloqueado NÃO impede mais o envio manual (aba Produtos) desde
    // 2026-08-15 — decisão explícita do usuário: quer poder mandar um
    // produto de grupo monitorado pra um canal que não tem esse grupo na
    // allow-list, sabendo do risco, mesma filosofia já aplicada ao
    // intervalo mínimo (ver comentário mais abaixo). Só avisa via `motivo`
    // (aparece na UI mesmo com elegivel:true, ver ProdutoCard.tsx), não
    // bloqueia mais. O disparo AUTOMÁTICO não passa por essa função (usa
    // proximoProdutoElegivel/listarPorNichos), então continua respeitando a
    // allow-list normalmente.
    const grupoStatus = grupoMonitoradoStatus(canal, produto);
    const avisoGrupoNaoPermitido =
      grupoStatus === "bloqueado" ? "grupo monitorado não permitido nesse canal — enviando manualmente mesmo assim" : undefined;

    // "bypass_nicho" (grupo permitido) e "bloqueado" (grupo não permitido,
    // mas liberado pro envio manual acima) pulam a checagem de nicho — o
    // filtro de nicho existe pra escolher canal automaticamente, não faz
    // sentido reaplicar quando o usuário já escolheu manualmente esse
    // produto especifico pra esse canal.
    if (grupoStatus === "sem_restricao" && !nichoElegivel(canal, produto.nicho)) {
      resultado.push({
        ...canal,
        elegivel: false,
        motivo: `categoria "${produto.nicho}" não permitida nesse canal`,
      });
      continue;
    }

    if (!fonteElegivel(canal, produto.fonte)) {
      resultado.push({
        ...canal,
        elegivel: false,
        motivo: `origem "${produto.fonte}" não permitida nesse canal`,
      });
      continue;
    }

    if (desconto < canal.descontoMinimo) {
      resultado.push({
        ...canal,
        elegivel: false,
        motivo: `desconto de ${desconto}% abaixo do mínimo do canal (${canal.descontoMinimo}%)`,
      });
      continue;
    }

    // Intervalo mínimo entre disparos NÃO é checado aqui de propósito — essa
    // função só afeta a lista de canais elegíveis pra ENVIO MANUAL (aba
    // Produtos), e o usuário quer poder mandar um produto na hora, sem
    // esperar o intervalo, sabendo do risco. O disparo AUTOMÁTICO continua
    // respeitando o intervalo normalmente (checagem própria, ver
    // agendadorDisparo.ts -> processarCanal), essa mudança não afeta ele.
    resultado.push({ ...canal, elegivel: true, motivo: avisoGrupoNaoPermitido });
  }

  return resultado;
}

/** Acha o próximo produto capturado elegível pras regras do canal — grupo monitorado sempre primeiro, resto intercalado entre ML/Shopee (ver comentário abaixo). */
export async function proximoProdutoElegivel(usuarioId: number, canal: CanalRow): Promise<ProdutoRow | null> {
  // Canal sem categorias definidas = "geral" = aceita produto de qualquer
  // nicho (ver nichoElegivel acima) — passa `null` pra não filtrar por
  // nicho nenhum na consulta.
  const nichosAceitos =
    canal.categoriasPermitidas && canal.categoriasPermitidas.length > 0 ? canal.categoriasPermitidas : null;

  // Alarga a busca com a allow-list de grupos monitorados (traz produto de
  // grupo permitido mesmo fora de nichosAceitos) — a outra metade do bypass
  // (excluir grupo BLOQUEADO que bateu no nicho por coincidência) é feita
  // no loop abaixo, em JS, já que SQL só alarga, não estreita esse caso.
  const candidatos = await produtosRepo.listarPorNichos(usuarioId, nichosAceitos, "capturado", canal.gruposMonitoradosPermitidos);

  const elegiveis: ProdutoRow[] = [];
  for (const produto of candidatos) {
    if (!fonteElegivel(canal, produto.fonte)) continue;
    if (grupoMonitoradoStatus(canal, produto) === "bloqueado") continue;
    const desconto = calcularDesconto(produto.precoOriginal, produto.precoPromocional);
    if (desconto >= canal.descontoMinimo) elegiveis.push(produto);
  }
  if (elegiveis.length === 0) return null;

  // `candidatos` já vem ordenado com grupo monitorado primeiro (ver
  // FONTE_PRIORITARIA em listarPorNichos) — se o primeiro elegível já é de
  // grupo monitorado, retorna direto, sem mexer em intercalação de
  // plataforma (prioridade de grupo monitorado nunca é afetada por isso).
  const primeiro = elegiveis[0];
  if (FONTES_MONITORADAS.has(primeiro.fonte)) return primeiro;

  // Daqui pra baixo só sobrou captura em massa (ML/Shopee) — intercala entre
  // as duas plataformas em vez de FIFO estrito por `criado_em`. Sem isso,
  // uma leva de captura mais antiga de uma plataforma monopoliza a fila
  // inteira até esgotar, enquanto a outra nunca sai (bug real: leva de
  // Shopee capturada minutos antes do ML travando o ML por horas, já que o
  // canal só dispara 1 produto a cada `intervaloMinimoMinutos`).
  const ultimaPlataforma = await configuracoesRepo.obterUltimaPlataformaBulkEnviada(usuarioId);
  const plataformaDesejada = ultimaPlataforma === "mercado_livre" ? "shopee" : "mercado_livre";

  const escolhido = elegiveis.find((p) => plataformaAfiliado(p.fonte) === plataformaDesejada) ?? primeiro;
  await configuracoesRepo.definirUltimaPlataformaBulkEnviada(usuarioId, plataformaAfiliado(escolhido.fonte));
  return escolhido;
}

export async function dispararParaCanal(usuarioId: number, produtoId: number, canalId: number): Promise<void> {
  const produto = await produtosRepo.buscarPorId(usuarioId, produtoId);
  if (!produto) throw new Error(`Produto ${produtoId} não encontrado`);

  const canal = await canaisRepo.buscarPorId(usuarioId, canalId);
  if (!canal) throw new Error(`Canal ${canalId} não encontrado`);

  if (canal.tipo !== "telegram" && canal.tipo !== "whatsapp") {
    throw new Error(`Envio para canais do tipo "${canal.tipo}" ainda não implementado`);
  }
  if (!produto.titulo || !produto.imagemUrl) {
    // Condição permanente — nada preenche título/imagem depois da captura,
    // então retentar nunca vai funcionar. Marca "falhou" na hora (não espera
    // LIMITE_FALHAS) pra não travar a fila atrás de um produto que nunca vai
    // conseguir ser disparado (mesmo bug do produto rejeitado pelo programa
    // de afiliados, causa raiz diferente — aqui o `throw` acontece antes do
    // try/catch que registra falha em disparos, então nunca contava).
    await produtosRepo.atualizarStatus(usuarioId, produtoId, "falhou");
    throw new Error("Produto sem título ou imagem, não é possível disparar — marcado como falhou");
  }

  let chamada = produto.chamada ?? undefined;
  if (!chamada && (await configuracoesRepo.obterChamadaIAAtiva(usuarioId))) {
    try {
      chamada = await gerarChamada(produto.titulo);
      await produtosRepo.atualizarChamada(usuarioId, produtoId, chamada);
    } catch (err) {
      logger.warn({ err, produtoId }, "falha ao gerar chamada via Ollama, seguindo sem ela");
    }
  }

  try {
    // Algumas fontes (ex.: captura de ofertas da Shopee via `productOfferV2`)
    // já entregam o link de afiliado pronto na captura — reaproveita em vez
    // de gerar de novo (evita chamada redundante à API e o link possivelmente
    // ficar diferente do que já foi guardado).
    const linkAfiliado =
      produto.urlAfiliado ?? (await gerarLinkAfiliado(usuarioId, plataformaAfiliado(produto.fonte), produto.urlOriginal));

    // O link de "resgatar cupom" mostrado no produto NUNCA é o link de
    // ativação raspado do post do grupo monitorado (produto.linkCupom) — esse
    // link rastreia a comissão pro afiliado DONO do grupo, não pro usuário.
    // Sempre usa o link de cupons Shopee fixo do próprio usuário (decisão
    // explícita dele), mesmo sendo genérico e não específico do produto.
    const linkCupom =
      produto.cupom && FONTES_SHOPEE.has(produto.fonte)
        ? ((await configuracoesRepo.obterLinkCupomShopeeFixo(usuarioId)) ?? undefined)
        : undefined;

    const legenda = gerarLegenda({
      titulo: produto.titulo,
      chamada,
      precoOriginal: produto.precoOriginal ?? undefined,
      precoPromocional: produto.precoPromocional ?? undefined,
      cupom: produto.cupom ?? undefined,
      linkCupom,
      precoNoPix: produto.precoNoPix,
      linkAfiliado,
    });

    // Imagem de produto Shopee vem do post (baixada localmente, ver
    // capturarProdutoShopee.ts), não é uma URL pública — usa a variante de
    // envio de arquivo local nesse caso. WhatsApp (Evolution, instância por
    // tenant) precisa de usuarioId; Telegram é um bot de plataforma
    // compartilhado entre tenants (ver comentário em integracoes/telegram/bot.ts),
    // por isso as duas famílias de função têm assinatura diferente aqui.
    const ehImagemLocal = !/^https?:\/\//i.test(produto.imagemUrl);
    if (canal.tipo === "telegram") {
      const enviar = ehImagemLocal ? enviarFotoLocalTelegram : enviarFotoTelegram;
      await enviar(produto.imagemUrl, legenda, canal.identificadorGrupo);
    } else {
      const enviar = ehImagemLocal ? enviarFotoLocalWhatsapp : enviarFotoWhatsapp;
      await enviar(usuarioId, produto.imagemUrl, legenda, canal.identificadorGrupo);
    }

    await disparosRepo.registrar(usuarioId, produtoId, canalId, "enviado");
    await produtosRepo.atualizarStatus(usuarioId, produtoId, "enviado", linkAfiliado);
  } catch (err) {
    await disparosRepo.registrar(usuarioId, produtoId, canalId, "falhou");

    const falhas = await disparosRepo.contarFalhas(usuarioId, produtoId);
    if (falhas >= LIMITE_FALHAS) {
      await produtosRepo.atualizarStatus(usuarioId, produtoId, "falhou");
      logger.warn(
        { usuarioId, produtoId, falhas },
        "produto desistido após falhas repetidas — não bloqueia mais a fila de disparo",
      );
    }

    throw err;
  }
}
