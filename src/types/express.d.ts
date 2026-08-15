// Estende o Request do Express com o usuário autenticado (ver
// src/servidor/middleware/autenticacao.ts) — toda rota depois desse
// middleware pode usar `req.usuarioId` direto, tipado, sem cast.
declare global {
  namespace Express {
    interface Request {
      usuarioId: number;
    }
  }
}

export {};
