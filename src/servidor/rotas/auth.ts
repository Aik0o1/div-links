import { Router } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import * as usuariosRepo from "../../repositorios/usuarios.js";
import * as sessoesRepo from "../../repositorios/sessoes.js";
import * as assinaturasRepo from "../../repositorios/assinaturas.js";
import { seedNichosPadrao } from "../../servicos/seedNichosPadrao.js";
import { DIAS_TRIAL_GRATIS } from "../../servicos/assinatura.js";
import { env } from "../../config/env.js";
import { gerarState, montarUrlAutorizacao, buscarUsuarioGoogle } from "../../integracoes/google/oauth.js";
import { logger } from "../../config/logger.js";
import { NOME_COOKIE_SESSAO, opcoesCookieSessao, exigirAutenticacao, hashToken } from "../middleware/autenticacao.js";
import { limiteLogin, limiteSignup } from "../middleware/rateLimit.js";

export const rotaAuth = Router();

const CUSTO_BCRYPT = 12;
// Mensagem genérica de propósito pra login errado — não vazar se o email
// existe ou não (diferencia "email não cadastrado" de "senha errada" e
// facilita enumerar contas cadastradas por tentativa e erro).
const ERRO_LOGIN_GENERICO = "email ou senha inválidos";

function gerarTokenBruto(): string {
  return randomBytes(32).toString("base64url");
}

async function criarSessaoECookie(res: import("express").Response, usuarioId: number, req: import("express").Request) {
  const token = gerarTokenBruto();
  await sessoesRepo.criar(usuarioId, hashToken(token), {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  res.cookie(NOME_COOKIE_SESSAO, token, opcoesCookieSessao);
}

rotaAuth.post("/signup", limiteSignup, async (req, res) => {
  const { email, senha, nome } = req.body;
  if (typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ erro: "email inválido" });
    return;
  }
  if (typeof senha !== "string" || senha.length < 8) {
    res.status(400).json({ erro: "senha precisa ter pelo menos 8 caracteres" });
    return;
  }

  try {
    const existente = await usuariosRepo.buscarPorEmail(email);
    if (existente) {
      res.status(409).json({ erro: "já existe uma conta com esse email" });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
    const usuario = await usuariosRepo.criar(email, senhaHash, typeof nome === "string" ? nome : undefined);
    await seedNichosPadrao(usuario.id);
    await assinaturasRepo.criarTrial(usuario.id, DIAS_TRIAL_GRATIS);
    await criarSessaoECookie(res, usuario.id, req);

    res.status(201).json({ id: usuario.id, email: usuario.email, nome: usuario.nome });
  } catch (err) {
    logger.error({ err, email }, "falha ao criar conta");
    res.status(500).json({ erro: "falha ao criar conta" });
  }
});

rotaAuth.post("/login", limiteLogin, async (req, res) => {
  const { email, senha } = req.body;
  if (typeof email !== "string" || typeof senha !== "string") {
    res.status(400).json({ erro: ERRO_LOGIN_GENERICO });
    return;
  }

  try {
    const usuario = await usuariosRepo.buscarPorEmail(email);
    // Mesmo sem usuário, roda um bcrypt.compare contra um hash qualquer —
    // sem isso, a resposta de "email não existe" é bem mais rápida que a de
    // "senha errada" (bcrypt é lento de propósito), um jeito fácil de
    // enumerar contas cadastradas só medindo tempo de resposta.
    const hashParaComparar = usuario?.senhaHash ?? "$2a$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinva";
    const senhaOk = await bcrypt.compare(senha, hashParaComparar);

    if (!usuario || !senhaOk || !usuario.ativo) {
      res.status(401).json({ erro: ERRO_LOGIN_GENERICO });
      return;
    }

    await criarSessaoECookie(res, usuario.id, req);
    res.json({ id: usuario.id, email: usuario.email, nome: usuario.nome });
  } catch (err) {
    logger.error({ err, email }, "falha no login");
    res.status(500).json({ erro: "falha ao entrar" });
  }
});

rotaAuth.post("/logout", async (req, res) => {
  const token = req.cookies?.[NOME_COOKIE_SESSAO];
  if (typeof token === "string" && token) {
    await sessoesRepo.removerPorHash(hashToken(token)).catch(() => {});
  }
  res.clearCookie(NOME_COOKIE_SESSAO, opcoesCookieSessao);
  res.status(204).end();
});

rotaAuth.get("/me", exigirAutenticacao, async (req, res) => {
  const usuario = await usuariosRepo.buscarPorId(req.usuarioId);
  if (!usuario) {
    res.status(401).json({ erro: "não autenticado" });
    return;
  }
  res.json({ id: usuario.id, email: usuario.email, nome: usuario.nome });
});

const NOME_COOKIE_STATE_GOOGLE = "google_oauth_state";
const OPCOES_COOKIE_STATE_GOOGLE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.nodeEnv === "production",
  path: "/api/auth",
  maxAge: 10 * 60 * 1000, // só precisa sobreviver até voltar do consentimento do Google
};

// Início do fluxo — redireciona pro consentimento do Google. É um <a href>
// de verdade no frontend (Login.tsx/Signup.tsx), não uma chamada fetch —
// precisa navegar o navegador de verdade pro Google, não dá pra fazer via XHR.
rotaAuth.get("/google", (req, res) => {
  const state = gerarState();
  res.cookie(NOME_COOKIE_STATE_GOOGLE, state, OPCOES_COOKIE_STATE_GOOGLE);
  res.redirect(montarUrlAutorizacao(state));
});

// Volta do Google com ?code=...&state=... — troca o code, acha/cria a
// conta e loga, sempre terminando num redirect de volta pro painel (nunca
// JSON: essa rota só é alcançada por navegação de página inteira, uma
// resposta JSON não teria pra onde ir).
rotaAuth.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const stateCookie = req.cookies?.[NOME_COOKIE_STATE_GOOGLE];
  res.clearCookie(NOME_COOKIE_STATE_GOOGLE, { path: "/api/auth" });

  if (typeof code !== "string" || typeof state !== "string" || !stateCookie || state !== stateCookie) {
    res.redirect("/?erro=google_state_invalido");
    return;
  }

  try {
    const contaGoogle = await buscarUsuarioGoogle(code);
    if (!contaGoogle.emailVerificado) {
      res.redirect("/?erro=google_email_nao_verificado");
      return;
    }

    let usuario = await usuariosRepo.buscarPorGoogleId(contaGoogle.id);
    if (!usuario) {
      // Mesmo email já cadastrado por senha antes — o Google já confirmou
      // que quem tá logando é dono desse email (email_verified), então
      // vincula em vez de tentar criar um segundo cadastro pro mesmo
      // email (bateria no índice único de email e falharia).
      const existentePorEmail = await usuariosRepo.buscarPorEmail(contaGoogle.email);
      if (existentePorEmail) {
        await usuariosRepo.vincularGoogleId(existentePorEmail.id, contaGoogle.id);
        usuario = existentePorEmail;
      } else {
        usuario = await usuariosRepo.criarComGoogle(contaGoogle.email, contaGoogle.id, contaGoogle.nome);
        await seedNichosPadrao(usuario.id);
        await assinaturasRepo.criarTrial(usuario.id, DIAS_TRIAL_GRATIS);
      }
    }

    if (!usuario.ativo) {
      res.redirect("/?erro=conta_inativa");
      return;
    }

    await criarSessaoECookie(res, usuario.id, req);
    res.redirect("/");
  } catch (err) {
    logger.error({ err }, "falha no login com Google");
    res.redirect("/?erro=google_falhou");
  }
});
