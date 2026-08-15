import { Router } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import * as usuariosRepo from "../../repositorios/usuarios.js";
import * as sessoesRepo from "../../repositorios/sessoes.js";
import { seedNichosPadrao } from "../../servicos/seedNichosPadrao.js";
import { logger } from "../../config/logger.js";
import { NOME_COOKIE_SESSAO, opcoesCookieSessao, exigirAutenticacao, hashToken } from "../middleware/autenticacao.js";

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

rotaAuth.post("/signup", async (req, res) => {
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
    await criarSessaoECookie(res, usuario.id, req);

    res.status(201).json({ id: usuario.id, email: usuario.email, nome: usuario.nome });
  } catch (err) {
    logger.error({ err, email }, "falha ao criar conta");
    res.status(500).json({ erro: "falha ao criar conta" });
  }
});

rotaAuth.post("/login", async (req, res) => {
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
