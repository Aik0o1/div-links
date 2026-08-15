import rateLimit from "express-rate-limit";

// Proteção contra força bruta de senha (POST /api/auth/login) — sem isso,
// alguém podia tentar senha atrás de senha sem limite nenhum contra um
// email conhecido. Limita por IP (não por email): nesse ponto ainda não
// sabemos se o email existe (ver ERRO_LOGIN_GENERICO em rotas/auth.ts, a
// mesma preocupação de não vazar enumeração de conta), então a única chave
// disponível pra limitar é o IP de quem está tentando. Conta toda tentativa
// (sucesso ou falha) — não dá pra saber o resultado antes de rodar.
//
// Store em memória (padrão da lib) é suficiente aqui: o processo roda como
// uma instância única (ver `iniciar.ts`), sem load balancer na frente. Se um
// dia isso virar múltiplas instâncias atrás de um proxy, precisa trocar pra
// um store compartilhado (Redis, já é dependência do projeto — ver
// `rate-limit-redis`) pra não resetar o limite por instância.
export const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de login. Tente de novo em alguns minutos." },
});

// Mais permissivo que o login (criar conta é uma ação legítima rara por IP,
// não algo que um usuário real repete dezenas de vezes), mas ainda limita
// criação de conta em massa vinda de um único IP.
export const limiteSignup = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas contas criadas a partir daqui recentemente. Tente de novo mais tarde." },
});
