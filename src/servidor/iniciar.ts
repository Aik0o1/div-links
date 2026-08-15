import { criarApp } from "./app.js";
import { iniciarAgendadorDisparo } from "./agendadorDisparo.js";
import { iniciarAgendadorMonitorTelegram } from "./agendadorMonitorTelegram.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

// Rede de segurança — desde o Node 15, uma promise rejeitada sem `.catch()`
// em lugar nenhum da cadeia vira uncaughtException e MATA O PROCESSO
// INTEIRO, mesmo que o código que a gerou seja um detalhe isolado (ex.:
// scraping de UM produto que falhou porque o Chrome fechou no meio de uma
// captura). Bug real, repetido várias vezes em produção (2026-08-06 a
// 2026-08-13): "browserContext.waitForEvent: Target page, context or
// browser has been closed" em criarPaginaEmBackground (paginaBackground.ts)
// derrubando o processo inteiro — disparo automático e monitoramento de
// grupos ficavam parados por horas até alguém notar e reiniciar na mão.
//
// Os pontos de entrada já têm try/catch (agendadorDisparo.ts,
// agendadorMonitorTelegram.ts, rotas do Express) — isso aqui é a segunda
// camada, pra qualquer rejeição que escape de algum caminho não coberto
// (ou um listener interno do Playwright, fora da nossa cadeia de await)
// só ser logada em vez de matar o serviço inteiro.
process.on("unhandledRejection", (err) => {
  logger.error({ err }, "promise rejeitada sem tratamento — logado, processo continua rodando");
});

const app = criarApp();

app.listen(env.portaUi, () => {
  logger.info(`painel disponível em http://localhost:${env.portaUi}`);
});

iniciarAgendadorDisparo();
iniciarAgendadorMonitorTelegram();

// configurarWebhook() não roda mais aqui uma vez fixo pra uma instância
// global — desde o multi-tenant, cada tenant tem a própria instância
// Evolution (`tenant-${usuarioId}`) e o webhook dela é configurado no
// próprio fluxo de conexão do WhatsApp (ver obterQrCode em
// integracoes/evolutionApi/instancia.ts).
