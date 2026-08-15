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
  // Só usado pro `secure` do cookie de sessão (auth) — cookie `secure` exige
  // HTTPS, que não existe em `npm run ui` local. Nunca setado manualmente
  // hoje; existe pra quando o deploy real (SaaS) rodar atrás de HTTPS.
  nodeEnv: process.env.NODE_ENV ?? "development",
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
  },
  telegramListener: {
    apiId: process.env.TELEGRAM_API_ID,
    apiHash: process.env.TELEGRAM_API_HASH,
  },
};

export function requiredTelegramConfig() {
  const { botToken } = env.telegram;
  if (!botToken) {
    throw new Error("Configuração do Telegram incompleta: defina TELEGRAM_BOT_TOKEN no .env");
  }
  return { botToken };
}

export function requiredEvolutionConfig() {
  const { url, apiKey } = env.evolutionApi;
  if (!apiKey) {
    throw new Error("Configuração da Evolution API incompleta: defina EVOLUTION_API_KEY no .env");
  }
  return { url, apiKey };
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
