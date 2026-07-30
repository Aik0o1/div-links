import { Router } from "express";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";

export const rotaConfiguracoes = Router();

// Secret nunca volta em texto puro pro frontend depois de salvo — só o
// booleano "configurado" (evita reexibir a credencial em requests futuras).
rotaConfiguracoes.get("/shopee", async (_req, res) => {
  const config = await configuracoesRepo.obterShopeeConfig();
  res.json({
    appId: config?.appId ?? "",
    configurado: !!(config?.appId && config?.secret),
  });
});

rotaConfiguracoes.put("/shopee", async (req, res) => {
  const { appId, secret } = req.body;
  if (typeof appId !== "string" || !appId.trim()) {
    res.status(400).json({ erro: "appId é obrigatório" });
    return;
  }
  const atual = await configuracoesRepo.obterShopeeConfig();
  // Secret vazio no PUT mantém o valor já salvo (permite editar só o App ID).
  const secretFinal = typeof secret === "string" && secret.trim() ? secret.trim() : atual?.secret;
  if (!secretFinal) {
    res.status(400).json({ erro: "secret é obrigatório na primeira configuração" });
    return;
  }
  await configuracoesRepo.definirShopeeConfig({ appId: appId.trim(), secret: secretFinal });
  res.json({ appId: appId.trim(), configurado: true });
});

rotaConfiguracoes.get("/", async (_req, res) => {
  res.json({
    descontoMinimo: await configuracoesRepo.obterDescontoMinimo(),
    linkCupomFixo: await configuracoesRepo.obterLinkCupomFixo(),
    linkCupomShopeeFixo: await configuracoesRepo.obterLinkCupomShopeeFixo(),
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
  const { descontoMinimo, linkCupomFixo, linkCupomShopeeFixo } = req.body;
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
  if (linkCupomShopeeFixo !== undefined) {
    if (typeof linkCupomShopeeFixo !== "string") {
      res.status(400).json({ erro: "linkCupomShopeeFixo precisa ser texto" });
      return;
    }
    await configuracoesRepo.definirLinkCupomShopeeFixo(linkCupomShopeeFixo);
  }
  res.json({
    descontoMinimo: await configuracoesRepo.obterDescontoMinimo(),
    linkCupomFixo: await configuracoesRepo.obterLinkCupomFixo(),
    linkCupomShopeeFixo: await configuracoesRepo.obterLinkCupomShopeeFixo(),
  });
});
