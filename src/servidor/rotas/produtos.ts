import { Router } from "express";
import path from "node:path";
import * as produtosRepo from "../../repositorios/produtos.js";
import type { ProdutoRow } from "../../repositorios/produtos.js";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";
import { capturarProdutosPorNicho } from "../../servicos/capturarProdutos.js";
import { capturarProdutosShopeePorNicho } from "../../servicos/capturarProdutosShopee.js";
import { capturarProdutoManual } from "../../servicos/capturarProdutoManual.js";
import { canaisElegiveis, dispararParaCanal } from "../../servicos/dispararProduto.js";
import { gerarChamada } from "../../integracoes/ollama/gerarChamada.js";
import { logger } from "../../config/logger.js";

export const rotaProdutos = Router();

/**
 * `imagemUrl` de produto de grupo monitorado (Shopee, Telegram ou WhatsApp)
 * é um caminho de arquivo local no servidor, não uma URL — o disparo lê
 * direto do disco (ver dispararProduto.ts), mas o navegador não consegue
 * carregar isso como `<img src>`. Só pra resposta da API (exibição no
 * card), reescreve pro caminho servido em /imagens-capturadas (ver
 * app.ts). Não altera o que fica salvo no banco nem o que o disparo usa.
 */
function paraExibicao(produto: ProdutoRow): ProdutoRow {
  if (!produto.imagemUrl || /^https?:\/\//i.test(produto.imagemUrl)) return produto;
  return { ...produto, imagemUrl: `/imagens-capturadas/${path.basename(produto.imagemUrl)}` };
}

/**
 * Id -> nome de exibição de todo grupo monitorado (Telegram + WhatsApp)
 * desse tenant — usado só pra mostrar "veio do grupo X" na aba Produtos
 * (ver ProdutoRow.grupoOrigemId). Grupo selecionado antes do campo `nome`
 * existir (ver configuracoes.ts) simplesmente não aparece aqui até o
 * usuário salvar a seleção de novo.
 */
async function mapaNomesGruposMonitorados(usuarioId: number): Promise<Map<string, string>> {
  const [telegramGrupos, whatsappGrupos] = await Promise.all([
    configuracoesRepo.obterTelegramListenerGrupos(usuarioId),
    configuracoesRepo.obterWhatsappGruposMonitorados(usuarioId),
  ]);
  const mapa = new Map<string, string>();
  for (const grupo of [...telegramGrupos, ...whatsappGrupos]) {
    if (grupo.nome) mapa.set(grupo.id, grupo.nome);
  }
  return mapa;
}

rotaProdutos.get("/", async (req, res) => {
  const { status, nicho, fonte } = req.query;
  const [produtos, nomesGrupos] = await Promise.all([
    produtosRepo.listar(req.usuarioId, {
      status: typeof status === "string" ? status : undefined,
      nicho: typeof nicho === "string" ? nicho : undefined,
      fonte: fonte === "mercado_livre" || fonte === "shopee" || fonte === "monitorados" ? fonte : undefined,
    }),
    mapaNomesGruposMonitorados(req.usuarioId),
  ]);
  res.json(
    produtos.map((produto) => ({
      ...paraExibicao(produto),
      grupoOrigemNome: produto.grupoOrigemId ? (nomesGrupos.get(produto.grupoOrigemId) ?? null) : null,
    })),
  );
});

// Apaga todos os produtos (inclusive já enviados — histórico de disparos vai
// junto por ON DELETE CASCADE, ver migration 004). Mesma operação que já
// roda sozinha antes de cada captura (capturarProdutos.ts), exposta aqui pra
// o usuário poder zerar a fila manualmente sem precisar recapturar na hora.
rotaProdutos.delete("/", async (req, res) => {
  try {
    await produtosRepo.removerTodos(req.usuarioId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "falha ao limpar produtos");
    res.status(500).json({ erro: (err as Error).message });
  }
});

rotaProdutos.post("/capturar", async (req, res) => {
  const { nicho } = req.query;
  if (typeof nicho !== "string" || !nicho) {
    res.status(400).json({ erro: "nicho é obrigatório (?nicho=...)" });
    return;
  }
  try {
    const resultado = await capturarProdutosPorNicho(req.usuarioId, nicho);
    res.json(resultado);
  } catch (err) {
    logger.error({ err, nicho }, "falha ao capturar produtos");
    res.status(500).json({ erro: (err as Error).message });
  }
});

rotaProdutos.post("/capturar-shopee", async (req, res) => {
  const { nicho } = req.query;
  if (typeof nicho !== "string" || !nicho) {
    res.status(400).json({ erro: "nicho é obrigatório (?nicho=...)" });
    return;
  }
  try {
    const resultado = await capturarProdutosShopeePorNicho(req.usuarioId, nicho);
    res.json(resultado);
  } catch (err) {
    logger.error({ err, nicho }, "falha ao capturar ofertas Shopee");
    res.status(500).json({ erro: (err as Error).message });
  }
});

// Captura avulsa de um produto específico por link (aba Produtos — "achei
// uma oferta, adiciona na fila"). Ver capturarProdutoManual.ts.
rotaProdutos.post("/capturar-manual", async (req, res) => {
  const { url, cupom, chamada, precoPromocional, precoNoPix, nicho } = req.body;
  if (typeof url !== "string" || !url) {
    res.status(400).json({ erro: "url é obrigatória" });
    return;
  }
  if (typeof nicho !== "string" || !nicho) {
    res.status(400).json({ erro: "nicho é obrigatório" });
    return;
  }
  try {
    const resultado = await capturarProdutoManual(req.usuarioId, {
      url,
      cupom: typeof cupom === "string" && cupom ? cupom : undefined,
      chamada: typeof chamada === "string" && chamada ? chamada : undefined,
      precoPromocional: typeof precoPromocional === "number" ? precoPromocional : undefined,
      precoNoPix: typeof precoNoPix === "boolean" ? precoNoPix : undefined,
      nicho,
    });
    if (!resultado) {
      res.status(409).json({ erro: "produto já capturado antes (mesmo título/url/nicho)" });
      return;
    }
    res.json(resultado);
  } catch (err) {
    logger.error({ err, url }, "falha ao capturar produto manualmente");
    res.status(500).json({ erro: (err as Error).message });
  }
});

// Edição manual do produto (aba Produtos — botão "Editar" em cada card).
// Só as colunas de conteúdo (não mexe em fonte/nicho/status/etc.).
rotaProdutos.put("/:id", async (req, res) => {
  const { titulo, precoOriginal, precoPromocional, imagemUrl, cupom } = req.body;
  const dados: Parameters<typeof produtosRepo.atualizar>[2] = {};
  if (titulo !== undefined) {
    if (typeof titulo !== "string" || !titulo.trim()) {
      res.status(400).json({ erro: "titulo precisa ser texto não vazio" });
      return;
    }
    dados.titulo = titulo;
  }
  if (precoOriginal !== undefined) {
    if (precoOriginal !== null && typeof precoOriginal !== "number") {
      res.status(400).json({ erro: "precoOriginal precisa ser número ou null" });
      return;
    }
    dados.precoOriginal = precoOriginal;
  }
  if (precoPromocional !== undefined) {
    if (precoPromocional !== null && typeof precoPromocional !== "number") {
      res.status(400).json({ erro: "precoPromocional precisa ser número ou null" });
      return;
    }
    dados.precoPromocional = precoPromocional;
  }
  if (imagemUrl !== undefined) {
    if (imagemUrl !== null && typeof imagemUrl !== "string") {
      res.status(400).json({ erro: "imagemUrl precisa ser texto ou null" });
      return;
    }
    dados.imagemUrl = imagemUrl;
  }
  if (cupom !== undefined) {
    if (cupom !== null && typeof cupom !== "string") {
      res.status(400).json({ erro: "cupom precisa ser texto ou null" });
      return;
    }
    dados.cupom = cupom;
  }

  try {
    const produto = await produtosRepo.atualizar(req.usuarioId, Number(req.params.id), dados);
    if (!produto) {
      res.status(404).json({ erro: "produto não encontrado" });
      return;
    }
    res.json(paraExibicao(produto));
  } catch (err) {
    logger.error({ err }, "falha ao editar produto");
    res.status(500).json({ erro: (err as Error).message });
  }
});

rotaProdutos.delete("/:id", async (req, res) => {
  try {
    await produtosRepo.remover(req.usuarioId, Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "falha ao apagar produto");
    res.status(500).json({ erro: (err as Error).message });
  }
});

rotaProdutos.get("/:id/canais-elegiveis", async (req, res) => {
  try {
    const canais = await canaisElegiveis(req.usuarioId, Number(req.params.id));
    res.json(canais);
  } catch (err) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

rotaProdutos.post("/:id/gerar-chamada", async (req, res) => {
  try {
    const produto = await produtosRepo.buscarPorId(req.usuarioId, Number(req.params.id));
    if (!produto || !produto.titulo) {
      res.status(404).json({ erro: "produto não encontrado" });
      return;
    }
    const chamada = await gerarChamada(produto.titulo);
    await produtosRepo.atualizarChamada(req.usuarioId, produto.id, chamada);
    res.json({ chamada });
  } catch (err) {
    logger.error({ err }, "falha ao gerar chamada");
    res.status(500).json({ erro: (err as Error).message });
  }
});

rotaProdutos.put("/:id/chamada", async (req, res) => {
  const { chamada } = req.body;
  if (typeof chamada !== "string") {
    res.status(400).json({ erro: "chamada (texto) é obrigatória" });
    return;
  }
  await produtosRepo.atualizarChamada(req.usuarioId, Number(req.params.id), chamada);
  res.json({ chamada });
});

rotaProdutos.post("/:id/disparar/:canalId", async (req, res) => {
  try {
    await dispararParaCanal(req.usuarioId, Number(req.params.id), Number(req.params.canalId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "falha ao disparar produto");
    res.status(500).json({ erro: (err as Error).message });
  }
});
