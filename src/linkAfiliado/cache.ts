import { redisConnection } from "../config/redis.js";
import type { GeradorDeLinkAfiliado } from "./tipos.js";

function chaveCache(usuarioId: number, plataforma: string, urlProduto: string): string {
  return `link_afiliado:${usuarioId}:${plataforma}:${urlProduto}`;
}

export function comCache(gerador: GeradorDeLinkAfiliado): GeradorDeLinkAfiliado {
  return {
    plataforma: gerador.plataforma,
    async gerar(usuarioId: number, urlProduto: string): Promise<string> {
      const chave = chaveCache(usuarioId, gerador.plataforma, urlProduto);

      const emCache = await redisConnection.get(chave);
      if (emCache) return emCache;

      const linkGerado = await gerador.gerar(usuarioId, urlProduto);
      await redisConnection.set(chave, linkGerado);
      return linkGerado;
    },
  };
}
