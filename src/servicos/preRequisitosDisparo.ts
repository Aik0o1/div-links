import * as canaisRepo from "../repositorios/canais.js";
import {
  obterShopeeConfig,
  obterMeliSessionCookie,
  obterMeliAfiliadoConfig,
  obterMeliCookieExpirado,
} from "../repositorios/configuracoes.js";
import { env } from "../config/env.js";
import { statusInstancia } from "../integracoes/evolutionApi/instancia.js";

export interface ItemPreRequisito {
  id: string;
  label: string;
  ok: boolean;
  obrigatorio: boolean;
  dica: string;
  aba: string;
}

// Mesma leitura de "aceita origem X" usada pra elegibilidade de disparo (ver
// fonteElegivel em dispararProduto.ts) — canal sem fontesPermitidas aceita
// qualquer origem, então conta como "aceita ML" e "aceita Shopee" ao mesmo
// tempo.
function aceitaOrigem(canal: canaisRepo.CanalRow, selecoes: string[]): boolean {
  const permitidas = canal.fontesPermitidas;
  if (!permitidas || permitidas.length === 0) return true;
  return permitidas.some((p) => selecoes.includes(p));
}

/**
 * Checklist de pré-requisitos pra ligar o disparo automático — só marca um
 * item como obrigatório quando ele é relevante pro que já está configurado
 * (ex.: não exige Shopee configurada se nenhum canal ativo aceita produto
 * dessa origem).
 */
export async function avaliarPreRequisitosDisparo(usuarioId: number): Promise<ItemPreRequisito[]> {
  const canais = await canaisRepo.listar(usuarioId);
  const ativos = canais.filter((c) => c.ativo);

  const temCanalWhatsapp = ativos.some((c) => c.tipo === "whatsapp");
  const temCanalTelegram = ativos.some((c) => c.tipo === "telegram");
  const temCanalML = ativos.some((c) => aceitaOrigem(c, ["mercado_livre", "monitorados"]));
  const temCanalShopee = ativos.some((c) => aceitaOrigem(c, ["shopee", "monitorados"]));

  const [whatsappStatus, meliOk] = await Promise.all([
    temCanalWhatsapp
      ? statusInstancia(usuarioId).catch(() => ({ conectado: false }))
      : Promise.resolve({ conectado: false }),
    // Desde 2026-08-13 a geração de link/captura do ML usa cookie de sessão
    // + HTTP puro, não mais Chrome (ver meliHttp.ts) — o pré-requisito real
    // é ter tag + cookie configurados, não uma janela de Chrome aberta.
    temCanalML
      ? Promise.all([obterMeliAfiliadoConfig(usuarioId), obterMeliSessionCookie(usuarioId)]).then(
          ([config, cookie]) => !!config?.tag && !!cookie,
        )
      : Promise.resolve(false),
  ]);

  const itens: ItemPreRequisito[] = [
    {
      id: "canal-ativo",
      label: "Pelo menos 1 canal de destino ativo",
      ok: ativos.length > 0,
      obrigatorio: true,
      dica: "Crie ou ative um canal na aba Canais/Grupos.",
      aba: "canais",
    },
  ];

  if (temCanalWhatsapp) {
    itens.push({
      id: "whatsapp-conectado",
      label: "WhatsApp conectado",
      ok: !!whatsappStatus.conectado,
      obrigatorio: true,
      dica: "Você tem canal ativo do WhatsApp — conecte a conta em Config. WhatsApp.",
      aba: "whatsapp",
    });
  }

  if (temCanalTelegram) {
    itens.push({
      id: "telegram-configurado",
      label: "Bot do Telegram configurado",
      ok: !!env.telegram.botToken,
      obrigatorio: true,
      dica: "Você tem canal ativo do Telegram — defina TELEGRAM_BOT_TOKEN em Config. Telegram.",
      aba: "telegram",
    });
  }

  if (temCanalML) {
    itens.push({
      id: "meli-conectado",
      label: "Mercado Livre conectado",
      ok: meliOk,
      obrigatorio: true,
      dica: "Algum canal ativo aceita produtos do Mercado Livre — conecte sua conta em Config. Afiliados.",
      aba: "afiliados",
    });

    // Diferente do item acima (só confere se tag+cookie EXISTEM) — esse
    // pega o cookie que existe mas parou de funcionar (expirado ou
    // bloqueado pelo ML), flagrado de verdade na última tentativa real de
    // uso (ver marcarMeliCookieExpirado em meliHttp.ts). Só faz sentido
    // checar se o item acima já está ok (senão é redundante com ele).
    if (meliOk && (await obterMeliCookieExpirado(usuarioId))) {
      itens.push({
        id: "meli-sessao-valida",
        label: "Sessão do Mercado Livre válida",
        ok: false,
        obrigatorio: true,
        dica: "O cookie salvo parou de funcionar (sessão expirada ou bloqueada pelo ML) — renove em Config. Afiliados.",
        aba: "afiliados",
      });
    }
  }

  if (temCanalShopee) {
    const configBanco = await obterShopeeConfig(usuarioId);
    // Sem fallback pro .env desde a transformação multi-tenant (ver
    // integracoes/shopee/config.ts) — cada tenant precisa configurar a
    // própria Shopee, sem vazar credencial/comissão de outro tenant.
    const shopeeOk = !!(configBanco?.appId && configBanco?.secret);
    itens.push({
      id: "shopee-configurada",
      label: "Shopee configurada (App ID + Secret)",
      ok: shopeeOk,
      obrigatorio: true,
      dica: "Algum canal ativo aceita produtos da Shopee — configure App ID/Secret em Config. Afiliados.",
      aba: "afiliados",
    });
  }

  return itens;
}
