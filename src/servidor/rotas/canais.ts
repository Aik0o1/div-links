import { Router } from "express";
import * as canaisRepo from "../../repositorios/canais.js";
import { obterLimitesAtuais } from "../../servicos/assinatura.js";

export const rotaCanais = Router();

rotaCanais.get("/", async (req, res) => {
  res.json(await canaisRepo.listar(req.usuarioId));
});

rotaCanais.post("/", async (req, res) => {
  const {
    nome,
    tipo,
    identificadorGrupo,
    categoriasPermitidas,
    fontesPermitidas,
    gruposMonitoradosPermitidos,
    descontoMinimo,
    intervaloMinimoMinutos,
  } = req.body;
  if (!tipo || !identificadorGrupo) {
    res.status(400).json({ erro: "tipo e identificadorGrupo são obrigatórios" });
    return;
  }

  const { limiteCanais } = await obterLimitesAtuais(req.usuarioId);
  const existentes = await canaisRepo.listar(req.usuarioId);
  if (existentes.length >= limiteCanais) {
    res.status(403).json({
      erro: `Seu plano permite até ${limiteCanais} canal(is) de destino. Remova um canal existente ou troque de plano pra adicionar mais.`,
    });
    return;
  }

  const canal = await canaisRepo.criar(req.usuarioId, {
    nome,
    tipo,
    identificadorGrupo,
    categoriasPermitidas,
    fontesPermitidas,
    gruposMonitoradosPermitidos,
    descontoMinimo,
    intervaloMinimoMinutos,
  });
  res.status(201).json(canal);
});

rotaCanais.put("/:id", async (req, res) => {
  const canal = await canaisRepo.atualizar(req.usuarioId, Number(req.params.id), req.body);
  if (!canal) {
    res.status(404).json({ erro: "canal não encontrado" });
    return;
  }
  res.json(canal);
});

rotaCanais.delete("/:id", async (req, res) => {
  try {
    await canaisRepo.remover(req.usuarioId, Number(req.params.id));
    res.status(204).end();
  } catch (err: any) {
    res.status(409).json({ erro: `Não foi possível remover o canal: ${err.message}` });
  }
});
