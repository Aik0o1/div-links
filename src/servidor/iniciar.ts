import { criarApp } from "./app.js";
import { iniciarAgendadorDisparo } from "./agendadorDisparo.js";
import { iniciarAgendadorMonitorTelegram } from "./agendadorMonitorTelegram.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { configurarWebhook } from "../integracoes/evolutionApi/instancia.js";

const app = criarApp();

app.listen(env.portaUi, () => {
  logger.info(`painel disponível em http://localhost:${env.portaUi}`);
});

iniciarAgendadorDisparo();
iniciarAgendadorMonitorTelegram();

configurarWebhook().catch((err) => {
  logger.warn({ err }, "não deu pra configurar o webhook da Evolution API (instância ainda não criada?)");
});
