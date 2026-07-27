import { Router } from "express";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../../db/pool.js";
import { redisConnection } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { statusToken } from "../../integracoes/mercadoLivre/auth.js";
import { statusInstancia } from "../../integracoes/evolutionApi/instancia.js";
import { statusListener } from "../../integracoes/telegramListener/cliente.js";
import { obterBrowser } from "../../integracoes/mercadoLivre/browserConexao.js";

export const rotaStatus = Router();

const RAIZ_PROJETO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PERFIL_CHROME_ML = path.join(RAIZ_PROJETO, ".playwright-ml-session");

async function chromeConectado(): Promise<boolean> {
  // Reaproveita a conexão CDP única do processo (ver browserConexao.ts) em
  // vez de abrir uma nova a cada checagem de status — chamar
  // chromium.connectOverCDP() direto aqui, sem nunca fechar, era uma fonte
  // de vazamento de memória toda vez que o painel era recarregado.
  try {
    const conectado = await Promise.race([
      obterBrowser().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000)),
    ]);
    return conectado;
  } catch {
    return false;
  }
}

rotaStatus.get("/", async (_req, res) => {
  const [db, redis, meli, chrome, whatsapp, telegramListener] = await Promise.all([
    pool
      .query("SELECT 1")
      .then(() => true)
      .catch(() => false),
    redisConnection
      .ping()
      .then(() => true)
      .catch(() => false),
    statusToken().catch(() => ({ conectado: false, expiraEm: null })),
    chromeConectado(),
    statusInstancia().catch(() => ({ existe: false, conectado: false, estado: null })),
    statusListener().catch(() => ({ autenticado: false, grupoMonitorado: null })),
  ]);

  res.json({
    db,
    redis,
    meli,
    telegram: { configurado: !!env.telegram.botToken },
    chrome: { conectado: chrome },
    whatsapp,
    telegramListener,
  });
});

// Abre a janela real do Chrome com debug remoto ligado, no profile usado pelo
// link builder do ML. É um processo solto (detached) — sobrevive mesmo se o
// painel reiniciar, exatamente como o fluxo manual via terminal.
rotaStatus.post("/abrir-chrome", (_req, res) => {
  try {
    const processo = spawn(
      "google-chrome",
      [
        "--remote-debugging-port=9222",
        `--user-data-dir=${PERFIL_CHROME_ML}`,
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
