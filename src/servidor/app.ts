import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rotaStatus } from "./rotas/status.js";
import { rotaNichos } from "./rotas/nichos.js";
import { rotaConfiguracoes } from "./rotas/configuracoes.js";
import { rotaCanais } from "./rotas/canais.js";
import { rotaProdutos } from "./rotas/produtos.js";
import { rotaDisparoAutomatico } from "./rotas/disparoAutomatico.js";
import { rotaWhatsapp } from "./rotas/whatsapp.js";
import { rotaTelegramListener } from "./rotas/telegramListener.js";

const DIRETORIO_PUBLIC = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "public",
);

export function criarApp() {
  const app = express();
  app.use(express.json());

  app.use("/api/status", rotaStatus);
  app.use("/api/nichos", rotaNichos);
  app.use("/api/configuracoes", rotaConfiguracoes);
  app.use("/api/canais", rotaCanais);
  app.use("/api/produtos", rotaProdutos);
  app.use("/api/disparo-automatico", rotaDisparoAutomatico);
  app.use("/api/whatsapp", rotaWhatsapp);
  app.use("/api/telegram-listener", rotaTelegramListener);

  app.use(express.static(DIRETORIO_PUBLIC));

  return app;
}
