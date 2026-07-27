import { Router } from "express";
import * as canaisRepo from "../../repositorios/canais.js";

export const rotaCanais = Router();

rotaCanais.get("/", async (_req, res) => {
  res.json(await canaisRepo.listar());
});

rotaCanais.post("/", async (req, res) => {
  const { nome, tipo, identificadorGrupo, categoriasPermitidas, descontoMinimo, intervaloMinimoMinutos } =
    req.body;
  if (!tipo || !identificadorGrupo) {
    res.status(400).json({ erro: "tipo e identificadorGrupo são obrigatórios" });
    return;
  }
  const canal = await canaisRepo.criar({
    nome,
    tipo,
    identificadorGrupo,
    categoriasPermitidas,
    descontoMinimo,
    intervaloMinimoMinutos,
  });
  res.status(201).json(canal);
});

rotaCanais.put("/:id", async (req, res) => {
  const canal = await canaisRepo.atualizar(Number(req.params.id), req.body);
  if (!canal) {
    res.status(404).json({ erro: "canal não encontrado" });
    return;
  }
  res.json(canal);
});

rotaCanais.delete("/:id", async (req, res) => {
  try {
    await canaisRepo.remover(Number(req.params.id));
    res.status(204).end();
  } catch (err: any) {
    res.status(409).json({ erro: `Não foi possível remover o canal: ${err.message}` });
  }
});
