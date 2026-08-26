import { Router, type Request, type Response } from "express";
import * as assinaturasRepo from "../../repositorios/assinaturas.js";
import * as pagamentosRepo from "../../repositorios/pagamentos.js";
import {
  iniciarCheckout,
  cancelarAssinatura,
  sincronizarStatusDoTenant,
  sincronizarStatusPorPreapprovalId,
  processarNotificacaoPagamento,
  listarPlanos,
} from "../../servicos/assinatura.js";
import { ehPlanoValido } from "../../servicos/planos.js";
import { validarAssinaturaWebhook } from "../../integracoes/mercadoPago/webhookSignature.js";
import { logger } from "../../config/logger.js";

export const rotaAssinatura = Router();

function paraExibicao(assinatura: assinaturasRepo.AssinaturaRow | null) {
  return {
    plano: assinatura?.plano ?? null,
    status: assinatura?.status ?? null,
    trialExpiraEm: assinatura?.trialExpiraEm ?? null,
    proximaCobrancaEm: assinatura?.proximaCobrancaEm ?? null,
    acessoLiberado: assinaturasRepo.acessoLiberado(assinatura),
  };
}

rotaAssinatura.get("/planos", (_req, res) => {
  res.json(listarPlanos());
});

rotaAssinatura.get("/", async (req, res) => {
  const assinatura = await assinaturasRepo.buscarPorUsuarioId(req.usuarioId);
  res.json(paraExibicao(assinatura));
});

rotaAssinatura.get("/pagamentos", async (req, res) => {
  res.json(await pagamentosRepo.listarPorUsuarioId(req.usuarioId));
});

// Sem HTTPS público local (ver plano), o Mercado Pago recusa back_url com
// localhost na criação da preapproval — usa um domínio genérico válido só
// pra passar na validação enquanto isso; o tenant volta manualmente e clica
// "Já paguei, verificar" (POST /verificar, que não depende do back_url).
function calcularBackUrl(req: Request): string {
  if (req.protocol === "https") return `${req.protocol}://${req.get("host")}/`;
  return "https://www.mercadopago.com.br/";
}

rotaAssinatura.post("/checkout", async (req, res) => {
  const { plano } = req.body;
  if (!ehPlanoValido(plano)) {
    res.status(400).json({ erro: "plano inválido" });
    return;
  }
  try {
    const initPoint = await iniciarCheckout(req.usuarioId, plano, calcularBackUrl(req));
    res.json({ initPoint });
  } catch (err) {
    logger.error({ err, usuarioId: req.usuarioId, plano }, "falha ao iniciar checkout do Mercado Pago");
    res.status(500).json({ erro: (err as Error).message });
  }
});

rotaAssinatura.post("/verificar", async (req, res) => {
  try {
    const assinatura = await sincronizarStatusDoTenant(req.usuarioId);
    res.json(paraExibicao(assinatura));
  } catch (err) {
    logger.error({ err, usuarioId: req.usuarioId }, "falha ao verificar status da assinatura");
    res.status(500).json({ erro: (err as Error).message });
  }
});

rotaAssinatura.post("/cancelar", async (req, res) => {
  try {
    await cancelarAssinatura(req.usuarioId);
    res.status(204).end();
  } catch (err) {
    logger.error({ err, usuarioId: req.usuarioId }, "falha ao cancelar assinatura");
    res.status(500).json({ erro: (err as Error).message });
  }
});

/**
 * Webhook do Mercado Pago — precisa ficar ANTES do middleware de auth (é o
 * MP chamando o painel, sem cookie de sessão nenhum pra validar). Registrado
 * como rota explícita em app.ts, não como parte deste router (mesmo padrão
 * do handlerWebhookWhatsapp). Responde 200 rápido e processa em segundo
 * plano — o MP espera resposta rápida e reentrega se não receber 2xx.
 *
 * Formato de notificação (webhooks v2): `{ type: "payment" | "subscription_preapproval", data: { id } }`
 * no corpo (ou nos query params em notificações legadas — cobre os dois).
 */
export function handlerWebhookMercadoPago(req: Request, res: Response): void {
  res.status(200).end();

  const tipo = req.body?.type ?? req.query.type;
  const dataId = req.body?.data?.id ?? req.query["data.id"];
  if (!tipo || !dataId) return;

  const assinaturaValida = validarAssinaturaWebhook(
    String(dataId),
    req.headers["x-signature"] as string | undefined,
    req.headers["x-request-id"] as string | undefined,
  );
  if (!assinaturaValida) {
    logger.warn({ tipo, dataId }, "webhook do Mercado Pago com assinatura inválida, ignorado");
    return;
  }

  const processar =
    tipo === "subscription_preapproval"
      ? sincronizarStatusPorPreapprovalId(String(dataId))
      : tipo === "payment"
        ? processarNotificacaoPagamento(String(dataId))
        : Promise.resolve();

  processar.catch((err) => {
    logger.error({ err, tipo, dataId }, "falha ao processar webhook do Mercado Pago");
  });
}
