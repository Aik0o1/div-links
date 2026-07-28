import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  logLevel: process.env.LOG_LEVEL ?? "info",
  portaUi: Number(process.env.PORTA_UI ?? "3000"),
  meli: {
    clientId: process.env.MELI_CLIENT_ID,
    clientSecret: process.env.MELI_CLIENT_SECRET,
    redirectUri: process.env.MELI_REDIRECT_URI,
    siteId: process.env.MELI_SITE_ID ?? "MLB",
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
  ollama: {
    url: process.env.OLLAMA_URL ?? "http://localhost:11434",
    modelo: process.env.OLLAMA_MODELO ?? "qwen2.5:3b",
  },
  evolutionApi: {
    url: process.env.EVOLUTION_API_URL ?? "http://localhost:8080",
    apiKey: process.env.EVOLUTION_API_KEY,
    instancia: process.env.EVOLUTION_INSTANCE ?? "divulga-links",
  },
  telegramListener: {
    apiId: process.env.TELEGRAM_API_ID,
    apiHash: process.env.TELEGRAM_API_HASH,
  },
  shopee: {
    appId: process.env.SHOPEE_APP_ID,
    secret: process.env.SHOPEE_SECRET,
  },
};

export function requiredMeliConfig() {
  const { clientId, clientSecret, redirectUri } = env.meli;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Configuração do Mercado Livre incompleta: defina MELI_CLIENT_ID, MELI_CLIENT_SECRET e MELI_REDIRECT_URI no .env",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function requiredTelegramConfig() {
  const { botToken } = env.telegram;
  if (!botToken) {
    throw new Error("Configuração do Telegram incompleta: defina TELEGRAM_BOT_TOKEN no .env");
  }
  return { botToken };
}

export function requiredEvolutionConfig() {
  const { url, apiKey, instancia } = env.evolutionApi;
  if (!apiKey) {
    throw new Error("Configuração da Evolution API incompleta: defina EVOLUTION_API_KEY no .env");
  }
  return { url, apiKey, instancia };
}

export function requiredTelegramListenerConfig() {
  const { apiId, apiHash } = env.telegramListener;
  if (!apiId || !apiHash) {
    throw new Error(
      "Configuração do monitor de Telegram incompleta: defina TELEGRAM_API_ID e TELEGRAM_API_HASH no .env",
    );
  }
  return { apiId: Number(apiId), apiHash };
}

export function requiredShopeeConfig() {
  const { appId, secret } = env.shopee;
  if (!appId || !secret) {
    throw new Error("Configuração da Shopee incompleta: defina SHOPEE_APP_ID e SHOPEE_SECRET no .env");
  }
  return { appId, secret };
}
