import { Router } from "express";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";
import { avaliarPreRequisitosDisparo } from "../../servicos/preRequisitosDisparo.js";

export const rotaDisparoAutomatico = Router();

const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

rotaDisparoAutomatico.get("/", async (req, res) => {
  const [ativo, janela] = await Promise.all([
    configuracoesRepo.obterDisparoAutomaticoAtivo(req.usuarioId),
    configuracoesRepo.obterJanelaDisparoAutomatico(req.usuarioId),
  ]);
  res.json({ ativo, janela });
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

// Janela de horário (ver agendadorDisparo.ts) — `{ inicio: null, fim: null }`
// remove a restrição (dispara a qualquer hora, comportamento default).
rotaDisparoAutomatico.put("/janela", async (req, res) => {
  const { inicio, fim } = req.body;

  if (inicio === null && fim === null) {
    await configuracoesRepo.definirJanelaDisparoAutomatico(req.usuarioId, null);
    res.json({ janela: null });
    return;
  }

  if (typeof inicio !== "string" || typeof fim !== "string" || !REGEX_HORA.test(inicio) || !REGEX_HORA.test(fim)) {
    res.status(400).json({ erro: "horário inválido — use o formato HH:MM" });
    return;
  }

  await configuracoesRepo.definirJanelaDisparoAutomatico(req.usuarioId, { inicio, fim });
  res.json({ janela: { inicio, fim } });
});
