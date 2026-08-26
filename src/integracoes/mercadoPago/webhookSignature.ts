import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

/**
 * Valida o header `x-signature` do webhook do Mercado Pago — sem isso,
 * qualquer requisição forjada pro endpoint público (`POST
 * /api/pagamentos/webhook`, registrado antes do middleware de auth, ver
 * app.ts) poderia fingir que uma assinatura foi paga e liberar acesso de
 * graça. Mais crítico aqui que no webhook do WhatsApp (mensagem errada é
 * inofensiva; assinatura forjada não é).
 *
 * Formato documentado pelo MP: header `x-signature` = `ts=<timestamp>,v1=<hash>`;
 * o "manifest" assinado é `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * (o id em minúsculo — MP normaliza), HMAC-SHA256 com o secret configurado
 * no painel (Suas integrações > aplicação > Webhooks > "Assinatura secreta").
 *
 * Sem `MERCADOPAGO_WEBHOOK_SECRET` configurado (não dá pra configurar sem
 * uma URL pública ainda, ver plano), a validação é pulada — logado como
 * aviso toda vez, nunca falha silenciosamente sem deixar rastro.
 */
export function validarAssinaturaWebhook(
  dataId: string,
  xSignature: string | undefined,
  xRequestId: string | undefined,
): boolean {
  const secret = env.mercadoPago.webhookSecret;
  if (!secret) {
    logger.warn("MERCADOPAGO_WEBHOOK_SECRET não configurado — validação de assinatura do webhook pulada");
    return true;
  }

  if (!xSignature || !xRequestId) return false;

  const partes = Object.fromEntries(
    xSignature.split(",").map((par) => par.trim().split("=").map((s) => s.trim())),
  );
  const ts = partes.ts;
  const hashRecebido = partes.v1;
  if (!ts || !hashRecebido) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const hashEsperado = createHmac("sha256", secret).update(manifest).digest("hex");

  const bufA = Buffer.from(hashRecebido, "hex");
  const bufB = Buffer.from(hashEsperado, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
