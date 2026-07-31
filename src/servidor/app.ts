import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rotaStatus } from "./rotas/status.js";
import { rotaNichos } from "./rotas/nichos.js";
import { rotaConfiguracoes } from "./rotas/configuracoes.js";
import { rotaCanais } from "./rotas/canais.js";
import { rotaProdutos } from "./rotas/produtos.js";
import { rotaCupons } from "./rotas/cupons.js";
import { rotaDisparoAutomatico } from "./rotas/disparoAutomatico.js";
import { rotaWhatsapp } from "./rotas/whatsapp.js";
import { rotaTelegramListener } from "./rotas/telegramListener.js";
import { rotaDashboard } from "./rotas/dashboard.js";

const DIRETORIO_PUBLIC = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "public",
);

// Imagens baixadas de posts de grupo monitorado (Shopee, Telegram e
// WhatsApp — ver telegramListener/cliente.ts e rotas/whatsapp.ts) são
// salvas com caminho absoluto de arquivo, não uma URL — precisam de uma
// rota servindo o diretório pra aparecerem no card de produto do painel
// (o navegador não consegue carregar "/home/.../arquivo.jpg" como <img>).
// O disparo em si (dispararProduto.ts) continua lendo o arquivo direto do
// disco, sem passar por essa rota.
const DIRETORIO_IMAGENS_CAPTURADAS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "data",
  "imagens-capturadas",
);

export function criarApp() {
  const app = express();
  app.use(express.json());

  app.use("/api/status", rotaStatus);
  app.use("/api/nichos", rotaNichos);
  app.use("/api/configuracoes", rotaConfiguracoes);
  app.use("/api/canais", rotaCanais);
  app.use("/api/produtos", rotaProdutos);
  app.use("/api/cupons", rotaCupons);
  app.use("/api/disparo-automatico", rotaDisparoAutomatico);
  app.use("/api/whatsapp", rotaWhatsapp);
  app.use("/api/telegram-listener", rotaTelegramListener);
  app.use("/api/dashboard", rotaDashboard);

  app.use("/imagens-capturadas", express.static(DIRETORIO_IMAGENS_CAPTURADAS));
  app.use(express.static(DIRETORIO_PUBLIC));

  return app;
}
