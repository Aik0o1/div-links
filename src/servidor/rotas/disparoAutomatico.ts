import { Router } from "express";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";
import { avaliarPreRequisitosDisparo } from "../../servicos/preRequisitosDisparo.js";

export const rotaDisparoAutomatico = Router();

rotaDisparoAutomatico.get("/", async (req, res) => {
  res.json({ ativo: await configuracoesRepo.obterDisparoAutomaticoAtivo(req.usuarioId) });
});

rotaDisparoAutomatico.post("/iniciar", async (req, res) => {
  const itens = await avaliarPreRequisitosDisparo(req.usuarioId);
  const pendentes = itens.filter((i) => i.obrigatorio && !i.ok);
  if (pendentes.length > 0) {
    res.status(400).json({
      erro: "Ainda falta configurar algo antes de iniciar o disparo automático.",
      pendentes,
    });
    return;
  }
  await configuracoesRepo.definirDisparoAutomaticoAtivo(req.usuarioId, true);
  res.json({ ativo: true });
});

rotaDisparoAutomatico.post("/pausar", async (req, res) => {
  await configuracoesRepo.definirDisparoAutomaticoAtivo(req.usuarioId, false);
  res.json({ ativo: false });
});
