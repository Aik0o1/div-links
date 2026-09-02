import { Router } from "express";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";

export const rotaConfiguracoes = Router();

// Secret nunca volta em texto puro pro frontend depois de salvo — só o
// booleano "configurado" (evita reexibir a credencial em requests futuras).
rotaConfiguracoes.get("/shopee", async (req, res) => {
  const config = await configuracoesRepo.obterShopeeConfig(req.usuarioId);
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
  const atual = await configuracoesRepo.obterShopeeConfig(req.usuarioId);
  // Secret vazio no PUT mantém o valor já salvo (permite editar só o App ID).
  const secretFinal = typeof secret === "string" && secret.trim() ? secret.trim() : atual?.secret;
  if (!secretFinal) {
    res.status(400).json({ erro: "secret é obrigatório na primeira configuração" });
    return;
  }
  await configuracoesRepo.definirShopeeConfig(req.usuarioId, { appId: appId.trim(), secret: secretFinal });
  res.json({ appId: appId.trim(), configurado: true });
});

// Cookie nunca volta em texto puro pro frontend depois de salvo — só o
// booleano "configurado" (mesmo motivo do secret da Shopee, mas ainda mais
// sensível aqui: é uma sessão logada de verdade).
rotaConfiguracoes.get("/mercado-livre", async (req, res) => {
  const [config, cookie] = await Promise.all([
    configuracoesRepo.obterMeliAfiliadoConfig(req.usuarioId),
    configuracoesRepo.obterMeliSessionCookie(req.usuarioId),
  ]);
  res.json({
    tag: config?.tag ?? "",
    cookieConfigurado: !!cookie,
  });
});

rotaConfiguracoes.put("/mercado-livre", async (req, res) => {
  const { tag, cookie } = req.body;
  if (typeof tag !== "string" || !tag.trim()) {
    res.status(400).json({ erro: "tag é obrigatória" });
    return;
  }
  await configuracoesRepo.definirMeliAfiliadoConfig(req.usuarioId, { tag: tag.trim() });
  // Cookie vazio no PUT mantém o valor já salvo (permite editar só a tag,
  // ou salvar a tag antes de ter um cookie ainda).
  if (typeof cookie === "string" && cookie.trim()) {
    await configuracoesRepo.definirMeliSessionCookie(req.usuarioId, cookie.trim());
    // Cookie novo — limpa qualquer aviso de "cookie vencido" que estava
    // sinalizado (ver marcarMeliCookieExpirado); se ainda não funcionar, a
    // próxima tentativa real de uso marca de novo sozinha.
    await configuracoesRepo.limparMeliCookieExpirado(req.usuarioId);
  }
  const cookieAtual = await configuracoesRepo.obterMeliSessionCookie(req.usuarioId);
  res.json({ tag: tag.trim(), cookieConfigurado: !!cookieAtual });
});

rotaConfiguracoes.get("/", async (req, res) => {
  res.json({
    linkCupomFixo: await configuracoesRepo.obterLinkCupomFixo(req.usuarioId),
    linkCupomShopeeFixo: await configuracoesRepo.obterLinkCupomShopeeFixo(req.usuarioId),
    chamadaIAAtiva: await configuracoesRepo.obterChamadaIAAtiva(req.usuarioId),
  });
});

rotaConfiguracoes.post("/chamada-ia/ativar", async (req, res) => {
  await configuracoesRepo.definirChamadaIAAtiva(req.usuarioId, true);
  res.json({ chamadaIAAtiva: true });
});

rotaConfiguracoes.post("/chamada-ia/desativar", async (req, res) => {
  await configuracoesRepo.definirChamadaIAAtiva(req.usuarioId, false);
  res.json({ chamadaIAAtiva: false });
});

rotaConfiguracoes.put("/", async (req, res) => {
  const { linkCupomFixo, linkCupomShopeeFixo } = req.body;
  if (linkCupomFixo !== undefined) {
    if (typeof linkCupomFixo !== "string") {
      res.status(400).json({ erro: "linkCupomFixo precisa ser texto" });
      return;
    }
    await configuracoesRepo.definirLinkCupomFixo(req.usuarioId, linkCupomFixo);
  }
  if (linkCupomShopeeFixo !== undefined) {
    if (typeof linkCupomShopeeFixo !== "string") {
      res.status(400).json({ erro: "linkCupomShopeeFixo precisa ser texto" });
      return;
    }
    await configuracoesRepo.definirLinkCupomShopeeFixo(req.usuarioId, linkCupomShopeeFixo);
  }
  res.json({
    linkCupomFixo: await configuracoesRepo.obterLinkCupomFixo(req.usuarioId),
    linkCupomShopeeFixo: await configuracoesRepo.obterLinkCupomShopeeFixo(req.usuarioId),
  });
});
