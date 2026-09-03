import { Button } from "@/components/ui/button";

/**
 * Link de verdade (não fetch/XHR) pra `GET /api/auth/google` — precisa
 * navegar o navegador pra fora do app, pro consentimento do Google, e
 * voltar via redirect (ver rotas/auth.ts). O ícone é o "G" oficial
 * colorido do Google, do jeito recomendado pelas guidelines deles pra
 * botão de login.
 */
export function GoogleButton() {
  return (
    <Button variant="outline" className="w-full" asChild>
      <a href="/api/auth/google">
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.27H12v4.51h5.92a5.07 5.07 0 0 1-2.19 3.32v2.77h3.55c2.08-1.92 3.28-4.74 3.28-8.33Z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.77c-.99.66-2.25 1.06-3.73 1.06-2.87 0-5.3-1.94-6.16-4.53H2.18v2.85C3.98 20.53 7.7 23 12 23Z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.85Z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.98 3.47 2.18 7.05l3.66 2.85c.86-2.59 3.29-4.52 6.16-4.52Z"
          />
        </svg>
        Continuar com Google
      </a>
    </Button>
  );
}
