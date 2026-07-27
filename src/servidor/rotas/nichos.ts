import { Router } from "express";
import * as nichosRepo from "../../repositorios/nichos.js";

export const rotaNichos = Router();

rotaNichos.get("/", async (_req, res) => {
  res.json(await nichosRepo.listar());
});

rotaNichos.post("/", async (req, res) => {
  const { id, nome, categoriaIds } = req.body;
  if (!id || !nome || !Array.isArray(categoriaIds)) {
    res.status(400).json({ erro: "id, nome e categoriaIds (array) são obrigatórios" });
    return;
  }
  const nicho = await nichosRepo.criar({ id, nome, categoriaIds });
  res.status(201).json(nicho);
});

rotaNichos.put("/:id", async (req, res) => {
  const { nome, categoriaIds, ativo } = req.body;
  const nicho = await nichosRepo.atualizar(req.params.id, { nome, categoriaIds, ativo });
  if (!nicho) {
    res.status(404).json({ erro: "nicho não encontrado" });
    return;
  }
  res.json(nicho);
});

rotaNichos.delete("/:id", async (req, res) => {
  await nichosRepo.remover(req.params.id);
  res.status(204).end();
});
