import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import * as sessoesRepo from "../../repositorios/sessoes.js";
import { env } from "../../config/env.js";

export const NOME_COOKIE_SESSAO = "sessao_token";

export function hashToken(tokenBruto: string): string {
  return createHash("sha256").update(tokenBruto).digest("hex");
}

/** Opções de cookie compartilhadas entre `criarSessaoECookie` (login/signup) e `logout` (pra `clearCookie` bater com o cookie original). */
export const opcoesCookieSessao = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.nodeEnv === "production",
  path: "/",
};

/**
 * Exige sessão válida (cookie httpOnly `sessao_token`) — anexa `req.usuarioId`
 * e segue. 401 se ausente, inválida ou expirada (nunca redireciona: quem
 * decide o que fazer com 401 é o frontend, ver `lib/api.ts`/`useSessao`).
 */
export async function exigirAutenticacao(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[NOME_COOKIE_SESSAO];
  if (typeof token !== "string" || !token) {
    res.status(401).json({ erro: "não autenticado" });
    return;
  }

  const sessao = await sessoesRepo.buscarValidaPorHash(hashToken(token));
  if (!sessao) {
    res.clearCookie(NOME_COOKIE_SESSAO, opcoesCookieSessao);
    res.status(401).json({ erro: "sessão expirada" });
    return;
  }

  req.usuarioId = sessao.usuarioId;
  sessoesRepo.tocarUltimoUso(sessao.id).catch(() => {});
  next();
}
