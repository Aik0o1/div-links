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

export async function canaisElegiveis(produtoId: number): Promise<CanalComElegibilidade[]> {
  const produto = await produtosRepo.buscarPorId(produtoId);
  if (!produto) throw new Error(`Produto ${produtoId} não encontrado`);

  const canais = await canaisRepo.listar();
  const desconto = calcularDesconto(produto.precoOriginal, produto.precoPromocional);

  const resultado: CanalComElegibilidade[] = [];

  for (const canal of canais) {
    if (!canal.ativo) {
      resultado.push({ ...canal, elegivel: false, motivo: "canal desativado" });
      continue;
    }

    if (!nichoElegivel(canal, produto.nicho)) {
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

    const ultimoEnvio = await disparosRepo.ultimoEnvioGeralPorCanal(canal.id);
    if (ultimoEnvio) {
      const minutosDesde = (Date.now() - new Date(ultimoEnvio).getTime()) / 60000;
      if (minutosDesde < canal.intervaloMinimoMinutos) {
        const faltam = Math.ceil(canal.intervaloMinimoMinutos - minutosDesde);
        resultado.push({
          ...canal,
          elegivel: false,
          motivo: `intervalo mínimo entre disparos não passou (faltam ${faltam} min)`,
        });
        continue;
      }
    }

    resultado.push({ ...canal, elegivel: true });
  }

  return resultado;
}

/** Acha o próximo produto capturado (mais antigo primeiro) elegível pras regras do canal. */
export async function proximoProdutoElegivel(canal: CanalRow): Promise<ProdutoRow | null> {
  // Canal sem categorias definidas = "geral" = aceita produto de qualquer
  // nicho (ver nichoElegivel acima) — passa `null` pra não filtrar por
  // nicho nenhum na consulta.
  const nichosAceitos =
    canal.categoriasPermitidas && canal.categoriasPermitidas.length > 0 ? canal.categoriasPermitidas : null;

  const candidatos = await produtosRepo.listarPorNichos(nichosAceitos, "capturado");

  for (const produto of candidatos) {
    if (!fonteElegivel(canal, produto.fonte)) continue;
    const desconto = calcularDesconto(produto.precoOriginal, produto.precoPromocional);
    if (desconto >= canal.descontoMinimo) return produto;
  }

  return null;
}

export async function dispararParaCanal(produtoId: number, canalId: number): Promise<void> {
  const produto = await produtosRepo.buscarPorId(produtoId);
  if (!produto) throw new Error(`Produto ${produtoId} não encontrado`);

  const canal = await canaisRepo.buscarPorId(canalId);
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
    await produtosRepo.atualizarStatus(produtoId, "falhou");
    throw new Error("Produto sem título ou imagem, não é possível disparar — marcado como falhou");
  }

  let chamada = produto.chamada ?? undefined;
  if (!chamada && (await configuracoesRepo.obterChamadaIAAtiva())) {
    try {
      chamada = await gerarChamada(produto.titulo);
      await produtosRepo.atualizarChamada(produtoId, chamada);
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
      produto.urlAfiliado ?? (await gerarLinkAfiliado(plataformaAfiliado(produto.fonte), produto.urlOriginal));
    const legenda = gerarLegenda({
      titulo: produto.titulo,
      chamada,
      precoOriginal: produto.precoOriginal ?? undefined,
      precoPromocional: produto.precoPromocional ?? undefined,
      cupom: produto.cupom ?? undefined,
      precoNoPix: produto.precoNoPix,
      linkAfiliado,
    });

    // Imagem de produto Shopee vem do post (baixada localmente, ver
    // capturarProdutoShopee.ts), não é uma URL pública — usa a variante de
    // envio de arquivo local nesse caso.
    const ehImagemLocal = !/^https?:\/\//i.test(produto.imagemUrl);
    const enviar =
      canal.tipo === "telegram"
        ? ehImagemLocal
          ? enviarFotoLocalTelegram
          : enviarFotoTelegram
        : ehImagemLocal
          ? enviarFotoLocalWhatsapp
          : enviarFotoWhatsapp;
    await enviar(produto.imagemUrl, legenda, canal.identificadorGrupo);

    await disparosRepo.registrar(produtoId, canalId, "enviado");
    await produtosRepo.atualizarStatus(produtoId, "enviado", linkAfiliado);
  } catch (err) {
    await disparosRepo.registrar(produtoId, canalId, "falhou");

    const falhas = await disparosRepo.contarFalhas(produtoId);
    if (falhas >= LIMITE_FALHAS) {
      await produtosRepo.atualizarStatus(produtoId, "falhou");
      logger.warn(
        { produtoId, falhas },
        "produto desistido após falhas repetidas — não bloqueia mais a fila de disparo",
      );
    }

    throw err;
  }
}
