import { Router } from "express";
import * as disparosRepo from "../../repositorios/disparos.js";
import * as produtosRepo from "../../repositorios/produtos.js";
import { avaliarPreRequisitosDisparo } from "../../servicos/preRequisitosDisparo.js";

export const rotaDashboard = Router();

rotaDashboard.get("/pre-requisitos", async (req, res) => {
  res.json({ itens: await avaliarPreRequisitosDisparo(req.usuarioId) });
});

rotaDashboard.get("/metricas", async (req, res) => {
  const [enviadosHoje, falhasHoje, capturadosHoje, pendentes, porHora] = await Promise.all([
    disparosRepo.contarHoje(req.usuarioId, "enviado"),
    disparosRepo.contarHoje(req.usuarioId, "falhou"),
    produtosRepo.contarCapturadosHoje(req.usuarioId),
    produtosRepo.contarPendentes(req.usuarioId),
    disparosRepo.porHoraHoje(req.usuarioId),
  ]);

  res.json({
    enviadosHoje,
    falhasHoje,
    capturadosHoje,
    pendentes,
    porHora,
  });
});
