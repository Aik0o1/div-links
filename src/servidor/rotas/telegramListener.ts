import { Router } from "express";
import * as listener from "../../integracoes/telegramListener/cliente.js";
import * as cuponsRepo from "../../repositorios/cupons.js";
import type { GrupoMonitoradoConfig } from "../../repositorios/configuracoes.js";

export const rotaTelegramListener = Router();

rotaTelegramListener.get("/status", async (_req, res) => {
  res.json(await listener.statusListener());
});

rotaTelegramListener.post("/telefone", async (req, res) => {
  try {
    const { telefone } = req.body;
    if (!telefone) {
      res.status(400).json({ erro: "telefone é obrigatório" });
      return;
    }
    await listener.iniciarLogin(telefone);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaTelegramListener.post("/codigo", async (req, res) => {
  try {
    const { codigo } = req.body;
    if (!codigo) {
      res.status(400).json({ erro: "codigo é obrigatório" });
      return;
    }
    const resultado = await listener.confirmarCodigo(codigo);
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaTelegramListener.post("/senha", async (req, res) => {
  try {
    const { senha } = req.body;
    if (!senha) {
      res.status(400).json({ erro: "senha é obrigatória" });
      return;
    }
    await listener.confirmarSenha(senha);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaTelegramListener.get("/grupos", async (_req, res) => {
  try {
    res.json(await listener.listarDialogos());
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaTelegramListener.post("/grupos-monitorados", async (req, res) => {
  try {
    const { grupos } = req.body as { grupos: GrupoMonitoradoConfig[] };
    if (!Array.isArray(grupos)) {
      res.status(400).json({ erro: "grupos (array de {id, nicho}) é obrigatório" });
      return;
    }
    await listener.definirGruposMonitorados(grupos);
    res.json({ ok: true, gruposMonitorados: grupos });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaTelegramListener.get("/cupons-recentes", async (_req, res) => {
  res.json(await cuponsRepo.listarRecentes());
});
