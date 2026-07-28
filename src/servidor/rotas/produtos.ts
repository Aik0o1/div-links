import { Router } from "express";
import * as produtosRepo from "../../repositorios/produtos.js";
import { capturarProdutos } from "../../servicos/capturarProdutos.js";
import { canaisElegiveis, dispararParaCanal } from "../../servicos/dispararProduto.js";
import { gerarChamada } from "../../integracoes/ollama/gerarChamada.js";
import { logger } from "../../config/logger.js";

export const rotaProdutos = Router();

rotaProdutos.get("/", async (req, res) => {
  const { status, nicho, fonte } = req.query;
  const produtos = await produtosRepo.listar({
    status: typeof status === "string" ? status : undefined,
    nicho: typeof nicho === "string" ? nicho : undefined,
    fonte: fonte === "mercado_livre" || fonte === "monitorados" ? fonte : undefined,
  });
  res.json(produtos);
});

// Apaga todos os produtos (inclusive já enviados — histórico de disparos vai
// junto por ON DELETE CASCADE, ver migration 004). Mesma operação que já
// roda sozinha antes de cada captura (capturarProdutos.ts), exposta aqui pra
// o usuário poder zerar a fila manualmente sem precisar recapturar na hora.
rotaProdutos.delete("/", async (_req, res) => {
  try {
    await produtosRepo.removerTodos();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "falha ao limpar produtos");
    res.status(500).json({ erro: (err as Error).message });
  }
});

rotaProdutos.post("/capturar", async (_req, res) => {
  try {
    const resultado = await capturarProdutos();
    res.json(resultado);
  } catch (err) {
    logger.error({ err }, "falha ao capturar produtos");
    res.status(500).json({ erro: (err as Error).message });
  }
});

rotaProdutos.delete("/:id", async (req, res) => {
  try {
    await produtosRepo.remover(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "falha ao apagar produto");
    res.status(500).json({ erro: (err as Error).message });
  }
});

rotaProdutos.get("/:id/canais-elegiveis", async (req, res) => {
  try {
    const canais = await canaisElegiveis(Number(req.params.id));
    res.json(canais);
  } catch (err) {
    res.status(404).json({ erro: (err as Error).message });
  }
});

rotaProdutos.post("/:id/gerar-chamada", async (req, res) => {
  try {
    const produto = await produtosRepo.buscarPorId(Number(req.params.id));
    if (!produto || !produto.titulo) {
      res.status(404).json({ erro: "produto não encontrado" });
      return;
    }
    const chamada = await gerarChamada(produto.titulo);
    await produtosRepo.atualizarChamada(produto.id, chamada);
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
  await produtosRepo.atualizarChamada(Number(req.params.id), chamada);
  res.json({ chamada });
});

rotaProdutos.post("/:id/disparar/:canalId", async (req, res) => {
  try {
    await dispararParaCanal(Number(req.params.id), Number(req.params.canalId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "falha ao disparar produto");
    res.status(500).json({ erro: (err as Error).message });
  }
});
