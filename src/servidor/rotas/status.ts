import { Router } from "express";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../../db/pool.js";
import { redisConnection } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { statusInstancia } from "../../integracoes/evolutionApi/instancia.js";
import { statusListener } from "../../integracoes/telegramListener/cliente.js";
import { chromeConectado } from "../../servicos/statusSistema.js";
import * as configuracoesRepo from "../../repositorios/configuracoes.js";

export const rotaStatus = Router();

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PERFIL_CHROME_ML = path.join(RAIZ_PROJETO, ".playwright-ml-session");

rotaStatus.get("/", async (_req, res) => {
  const [db, redis, chrome, whatsapp, telegramListener, meliCookie] = await Promise.all([
    pool
      .query("SELECT 1")
      .then(() => true)
      .catch(() => false),
    redisConnection
      .ping()
      .then(() => true)
      .catch(() => false),
    chromeConectado(),
    statusInstancia().catch(() => ({ existe: false, conectado: false, estado: null })),
    statusListener().catch(() => ({ autenticado: false, grupoMonitorado: null })),
    configuracoesRepo.obterMeliSessionCookie().then((c) => !!c),
  ]);

  res.json({
    db,
    redis,
    telegram: { configurado: !!env.telegram.botToken },
    chrome: { conectado: chrome },
    whatsapp,
    telegramListener,
    meli: { cookieConfigurado: meliCookie },
  });
});

// Cookie/tag de afiliado do Mercado Livre são editados pela aba Config.
// Afiliados (ver rotaConfiguracoes -> GET/PUT /configuracoes/mercado-livre)
// — aqui só o indicador de saúde acima (`meli.cookieConfigurado`).

// Abre a janela real do Chrome com debug remoto ligado, no profile usado pelo
// link builder do ML. Não é mais necessário pro funcionamento normal do
// sistema desde 2026-08-13 (captura e geração de link passaram a usar
// cookie de sessão + HTTP puro, ver meliHttp.ts) — mantido só como jeito
// alternativo de pegar/renovar o cookie manualmente, se precisar. É um
// processo solto (detached) — sobrevive mesmo se o painel reiniciar.
//
// As duas flags `--disable-*backgrounding*` são essenciais: sem elas, o
// Chrome para de produzir frames de tela pra essa janela assim que ela é
// minimizada ou fica atrás de outra (comum no Wayland, que só compõe janela
// visível). O JS da página continua rodando normal (por isso o `Target
// createTarget` e o `evaluate` nunca davam erro), mas o Playwright espera o
// elemento ficar "stable" comparando frames renderizados consecutivos —
// sem frame novo sendo produzido, essa espera nunca termina. Sintoma
// confirmado em produção (2026-08-10): clique no botão "Gerar" do link
// builder travando 30s com timeout, janela minimizada.
rotaStatus.post("/abrir-chrome", (_req, res) => {
  try {
    const processo = spawn(
      "google-chrome",
      [
        "--remote-debugging-port=9222",
        `--user-data-dir=${PERFIL_CHROME_ML}`,
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "https://www.mercadolivre.com.br/afiliados/linkbuilder#hub",
      ],
      { detached: true, stdio: "ignore" },
    );
    processo.on("error", (err) => {
      logger.error({ err }, "falha ao abrir o Chrome pelo painel");
    });
    processo.unref();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ erro: err.message });
  }
});
