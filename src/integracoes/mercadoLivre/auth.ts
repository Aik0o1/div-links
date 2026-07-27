import { randomUUID } from "node:crypto";
import { requiredMeliConfig } from "../../config/env.js";
import { pool } from "../../db/pool.js";

const AUTH_URL = "https://auth.mercadolivre.com.br/authorization";
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const PLATAFORMA = "mercado_livre";

// Margem de segurança antes do access_token expirar (6h de validade na Mercado Livre).
const MARGEM_EXPIRACAO_MS = 5 * 60 * 1000;

interface RespostaToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export function buildAuthorizationUrl(): { url: string; state: string } {
  const { clientId, redirectUri } = requiredMeliConfig();
  const state = randomUUID();
  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return { url: url.toString(), state };
}

async function trocarPorToken(params: Record<string, string>): Promise<RespostaToken> {
  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(
      `Falha ao obter token do Mercado Livre (${resposta.status}): ${corpo}`,
    );
  }

  return (await resposta.json()) as RespostaToken;
}

async function salvarTokens(tokens: RespostaToken): Promise<void> {
  const expiraEm = new Date(Date.now() + tokens.expires_in * 1000);
  await pool.query(
    `INSERT INTO oauth_tokens (plataforma, access_token, refresh_token, expira_em, atualizado_em)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (plataforma) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expira_em = EXCLUDED.expira_em,
       atualizado_em = now()`,
    [PLATAFORMA, tokens.access_token, tokens.refresh_token, expiraEm],
  );
}

export async function autorizarComCodigo(code: string): Promise<void> {
  const { clientId, clientSecret, redirectUri } = requiredMeliConfig();
  const tokens = await trocarPorToken({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  await salvarTokens(tokens);
}

async function renovarToken(refreshToken: string): Promise<RespostaToken> {
  const { clientId, clientSecret } = requiredMeliConfig();
  const tokens = await trocarPorToken({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  await salvarTokens(tokens);
  return tokens;
}

export async function statusToken(): Promise<{ conectado: boolean; expiraEm: Date | null }> {
  const { rows } = await pool.query<{ expira_em: Date }>(
    "SELECT expira_em FROM oauth_tokens WHERE plataforma = $1",
    [PLATAFORMA],
  );
  const registro = rows[0];
  return { conectado: !!registro, expiraEm: registro?.expira_em ?? null };
}

export async function getValidAccessToken(): Promise<string> {
  const { rows } = await pool.query<{
    access_token: string;
    refresh_token: string;
    expira_em: Date;
  }>("SELECT access_token, refresh_token, expira_em FROM oauth_tokens WHERE plataforma = $1", [
    PLATAFORMA,
  ]);

  const registro = rows[0];
  if (!registro) {
    throw new Error(
      "Nenhum token do Mercado Livre encontrado. Rode `npm run meli:autorizar` primeiro.",
    );
  }

  const expiraEm = new Date(registro.expira_em).getTime();
  if (expiraEm - Date.now() > MARGEM_EXPIRACAO_MS) {
    return registro.access_token;
  }

  const novosTokens = await renovarToken(registro.refresh_token);
  return novosTokens.access_token;
}
