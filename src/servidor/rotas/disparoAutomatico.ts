import { Router } from "express";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";

export const rotaDisparoAutomatico = Router();

rotaDisparoAutomatico.get("/", async (_req, res) => {
  res.json({ ativo: await configuracoesRepo.obterDisparoAutomaticoAtivo() });
});

rotaDisparoAutomatico.post("/iniciar", async (_req, res) => {
  await configuracoesRepo.definirDisparoAutomaticoAtivo(true);
  res.json({ ativo: true });
});

rotaDisparoAutomatico.post("/pausar", async (_req, res) => {
  await configuracoesRepo.definirDisparoAutomaticoAtivo(false);
  res.json({ ativo: false });
});
