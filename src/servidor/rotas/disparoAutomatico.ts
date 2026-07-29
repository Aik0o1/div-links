import { Router } from "express";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";
import { avaliarPreRequisitosDisparo } from "../../servicos/preRequisitosDisparo.js";

export const rotaDisparoAutomatico = Router();

rotaDisparoAutomatico.get("/", async (_req, res) => {
  res.json({ ativo: await configuracoesRepo.obterDisparoAutomaticoAtivo() });
});

rotaDisparoAutomatico.post("/iniciar", async (_req, res) => {
  const itens = await avaliarPreRequisitosDisparo();
  const pendentes = itens.filter((i) => i.obrigatorio && !i.ok);
  if (pendentes.length > 0) {
    res.status(400).json({
      erro: "Ainda falta configurar algo antes de iniciar o disparo automático.",
      pendentes,
    });
    return;
  }
  await configuracoesRepo.definirDisparoAutomaticoAtivo(true);
  res.json({ ativo: true });
});

rotaDisparoAutomatico.post("/pausar", async (_req, res) => {
  await configuracoesRepo.definirDisparoAutomaticoAtivo(false);
  res.json({ ativo: false });
});
