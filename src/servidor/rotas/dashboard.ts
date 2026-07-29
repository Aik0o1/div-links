import { Router } from "express";
import * as disparosRepo from "../../repositorios/disparos.js";
import * as produtosRepo from "../../repositorios/produtos.js";
import { avaliarPreRequisitosDisparo } from "../../servicos/preRequisitosDisparo.js";

export const rotaDashboard = Router();

rotaDashboard.get("/pre-requisitos", async (_req, res) => {
  res.json({ itens: await avaliarPreRequisitosDisparo() });
});

rotaDashboard.get("/metricas", async (_req, res) => {
  const [enviadosHoje, falhasHoje, capturadosHoje, pendentes, porHora] = await Promise.all([
    disparosRepo.contarHoje("enviado"),
    disparosRepo.contarHoje("falhou"),
    produtosRepo.contarCapturadosHoje(),
    produtosRepo.contarPendentes(),
    disparosRepo.porHoraHoje(),
  ]);

  res.json({
    enviadosHoje,
    falhasHoje,
    capturadosHoje,
    pendentes,
    porHora,
  });
});
