import { Router } from "express";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";

export const rotaConfiguracoes = Router();

rotaConfiguracoes.get("/", async (_req, res) => {
  res.json({
    descontoMinimo: await configuracoesRepo.obterDescontoMinimo(),
    linkCupomFixo: await configuracoesRepo.obterLinkCupomFixo(),
    chamadaIAAtiva: await configuracoesRepo.obterChamadaIAAtiva(),
  });
});

rotaConfiguracoes.post("/chamada-ia/ativar", async (_req, res) => {
  await configuracoesRepo.definirChamadaIAAtiva(true);
  res.json({ chamadaIAAtiva: true });
});

rotaConfiguracoes.post("/chamada-ia/desativar", async (_req, res) => {
  await configuracoesRepo.definirChamadaIAAtiva(false);
  res.json({ chamadaIAAtiva: false });
});

rotaConfiguracoes.put("/", async (req, res) => {
  const { descontoMinimo, linkCupomFixo } = req.body;
  if (descontoMinimo !== undefined) {
    if (typeof descontoMinimo !== "number") {
      res.status(400).json({ erro: "descontoMinimo precisa ser número" });
      return;
    }
    await configuracoesRepo.definirDescontoMinimo(descontoMinimo);
  }
  if (linkCupomFixo !== undefined) {
    if (typeof linkCupomFixo !== "string") {
      res.status(400).json({ erro: "linkCupomFixo precisa ser texto" });
      return;
    }
    await configuracoesRepo.definirLinkCupomFixo(linkCupomFixo);
  }
  res.json({
    descontoMinimo: await configuracoesRepo.obterDescontoMinimo(),
    linkCupomFixo: await configuracoesRepo.obterLinkCupomFixo(),
  });
});
