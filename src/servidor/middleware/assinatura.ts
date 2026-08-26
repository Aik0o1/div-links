import type { Request, Response, NextFunction } from "express";
import * as assinaturasRepo from "../../repositorios/assinaturas.js";

/**
 * Exige assinatura com acesso liberado (ativa/isenta, ou trial dentro do
 * prazo — ver acessoLiberado em repositorios/assinaturas.ts). 402 (Payment
 * Required) com `bloqueadoPorAssinatura: true` no corpo — o frontend usa
 * esse campo pra mostrar a tela de "assine pra continuar" em vez do painel
 * (ver lib/api.ts / App.tsx), nunca um simples erro genérico.
 *
 * Montado em app.ts DEPOIS de exigirAutenticacao e DEPOIS de `/api/assinatura`
 * (essa rota nunca pode ficar presa no próprio bloqueio, senão o tenant
 * bloqueado não consegue nem ver os planos pra assinar).
 */
export async function exigirAssinaturaAtiva(req: Request, res: Response, next: NextFunction): Promise<void> {
  const assinatura = await assinaturasRepo.buscarPorUsuarioId(req.usuarioId);
  if (!assinaturasRepo.acessoLiberado(assinatura)) {
    res.status(402).json({ erro: "assinatura inativa", bloqueadoPorAssinatura: true });
    return;
  }
  next();
}
