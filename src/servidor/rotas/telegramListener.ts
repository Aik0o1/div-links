import { Router } from "express";
import * as listener from "../../integracoes/telegramListener/cliente.js";
import * as cuponsRepo from "../../repositorios/cupons.js";
import type { GrupoMonitoradoConfig } from "../../repositorios/configuracoes.js";
import { validarLimiteGruposMonitorados } from "../../servicos/assinatura.js";

export const rotaTelegramListener = Router();

rotaTelegramListener.get("/status", async (req, res) => {
  res.json(await listener.statusListener(req.usuarioId));
});

rotaTelegramListener.post("/telefone", async (req, res) => {
  try {
    const { telefone } = req.body;
    if (!telefone) {
      res.status(400).json({ erro: "telefone é obrigatório" });
      return;
    }
    await listener.iniciarLogin(req.usuarioId, telefone);
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
    const resultado = await listener.confirmarCodigo(req.usuarioId, codigo);
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
    await listener.confirmarSenha(req.usuarioId, senha);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaTelegramListener.get("/grupos", async (req, res) => {
  try {
    res.json(await listener.listarDialogos(req.usuarioId));
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
    const limite = await validarLimiteGruposMonitorados(req.usuarioId, "telegram", grupos.length);
    if (!limite.ok) {
      res.status(403).json({
        erro: `Seu plano permite até ${limite.limite} grupo(s) monitorado(s) no total (WhatsApp + Telegram). Essa seleção passaria de ${limite.total}.`,
      });
      return;
    }
    await listener.definirGruposMonitorados(req.usuarioId, grupos);
    res.json({ ok: true, gruposMonitorados: grupos });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});

rotaTelegramListener.get("/cupons-recentes", async (req, res) => {
  res.json(await cuponsRepo.listarRecentes(req.usuarioId));
});
