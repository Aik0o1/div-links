import { randomBytes } from "node:crypto";
import { requiredGoogleAuthConfig } from "../../config/env.js";

const URL_AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth";
const URL_TOKEN = "https://oauth2.googleapis.com/token";
const URL_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

export function gerarState(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Monta a URL do consentimento do Google — `state` é um valor aleatório
 * guardado num cookie de curta duração (ver rotas/auth.ts) e conferido de
 * volta no callback, proteção padrão contra CSRF nesse fluxo (alguém
 * forjar um /auth/google/callback?code=... apontando pra conta Google de
 * um atacante, tentando logar a vítima nela).
 */
export function montarUrlAutorizacao(state: string): string {
  const { clientId, redirectUri } = requiredGoogleAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    // Sempre mostra o seletor de conta — sem isso o Google pula direto pra
    // única conta logada no navegador, o que atrapalha testar com mais de
    // uma conta na mesma máquina.
    prompt: "select_account",
  });
  return `${URL_AUTORIZACAO}?${params}`;
}

export interface UsuarioGoogle {
  /** Id estável da conta Google ("sub") — nunca muda pra uma mesma conta, diferente do email. */
  id: string;
  email: string;
  emailVerificado: boolean;
  nome: string | null;
}

/**
 * Troca o `code` do callback por um access token e busca os dados da conta
 * no userinfo do Google — evita parsear/validar o `id_token` (JWT) na mão;
 * o access token já veio de uma troca servidor-a-servidor autenticada com
 * o client secret, então confiar na resposta do userinfo pra esse token é
 * seguro sem precisar verificar assinatura JWT/JWKS por conta própria.
 */
export async function buscarUsuarioGoogle(code: string): Promise<UsuarioGoogle> {
  const { clientId, clientSecret, redirectUri } = requiredGoogleAuthConfig();

  const respostaToken = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!respostaToken.ok) {
    throw new Error(`Google recusou o code (${respostaToken.status}): ${await respostaToken.text()}`);
  }
  const { access_token: accessToken } = (await respostaToken.json()) as { access_token: string };

  const respostaUserinfo = await fetch(URL_USERINFO, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!respostaUserinfo.ok) {
    throw new Error(`Falha ao buscar userinfo do Google (${respostaUserinfo.status})`);
  }
  const dados = (await respostaUserinfo.json()) as {
    sub: string;
    email: string;
    email_verified: boolean;
    name?: string;
  };

  return {
    id: dados.sub,
    email: dados.email,
    emailVerificado: dados.email_verified,
    nome: dados.name ?? null,
  };
}
