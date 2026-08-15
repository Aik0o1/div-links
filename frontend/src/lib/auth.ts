import { useCallback, useEffect, useState } from "react";
import { api, EVENTO_NAO_AUTENTICADO } from "./api";

export interface UsuarioSessao {
  id: number;
  email: string;
  nome: string | null;
}

/**
 * Sessão do usuário logado — checa `GET /api/auth/me` (cookie httpOnly, ver
 * middleware/autenticacao.ts no backend) uma vez ao montar, e escuta o
 * evento global de 401 (ver EVENTO_NAO_AUTENTICADO em lib/api.ts) pra
 * derrubar de volta pro login se a sessão expirar em qualquer chamada,
 * não só nessa checagem inicial.
 */
export function useSessao() {
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(null);
  const [carregando, setCarregando] = useState(true);

  const verificar = useCallback(async () => {
    try {
      const dados = await api<UsuarioSessao>("/auth/me");
      setUsuario(dados);
    } catch {
      setUsuario(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    verificar();
  }, [verificar]);

  useEffect(() => {
    const aoDeslogar = () => setUsuario(null);
    window.addEventListener(EVENTO_NAO_AUTENTICADO, aoDeslogar);
    return () => window.removeEventListener(EVENTO_NAO_AUTENTICADO, aoDeslogar);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setUsuario(null);
    }
  }, []);

  return { usuario, carregando, definirUsuario: setUsuario, logout };
}
