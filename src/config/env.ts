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
  evolutionApi: {
    url: process.env.EVOLUTION_API_URL ?? "http://localhost:8080",
    apiKey: process.env.EVOLUTION_API_KEY,
  },
  telegramListener: {
    apiId: process.env.TELEGRAM_API_ID,
    apiHash: process.env.TELEGRAM_API_HASH,
  },
  mercadoPago: {
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
    // Só existe depois de configurar a URL de notificação no painel do MP
    // (precisa de HTTPS público) — sem ela, o webhook ainda funciona pra
    // decidir O QUE buscar, mas não dá pra validar que a notificação
    // realmente veio do Mercado Pago (ver mercadoPago/webhookSignature.ts).
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Tem que bater EXATAMENTE com o URI cadastrado no Google Cloud Console
    // (Credentials -> OAuth client -> Authorized redirect URIs).
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
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

export function requiredMercadoPagoConfig() {
  const { accessToken } = env.mercadoPago;
  if (!accessToken) {
    throw new Error("Configuração do Mercado Pago incompleta: defina MERCADOPAGO_ACCESS_TOKEN no .env");
  }
  return { accessToken };
}

export function requiredGoogleAuthConfig() {
  const { clientId, clientSecret, redirectUri } = env.google;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Login com Google incompleto: defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env",
    );
  }
  return { clientId, clientSecret, redirectUri };
}
