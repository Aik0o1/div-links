import { redisConnection } from "../config/redis.js";
import type { GeradorDeLinkAfiliado } from "./tipos.js";

function chaveCache(plataforma: string, urlProduto: string): string {
  return `link_afiliado:${plataforma}:${urlProduto}`;
}

export function comCache(gerador: GeradorDeLinkAfiliado): GeradorDeLinkAfiliado {
  return {
    plataforma: gerador.plataforma,
    async gerar(urlProduto: string): Promise<string> {
      const chave = chaveCache(gerador.plataforma, urlProduto);

      const emCache = await redisConnection.get(chave);
      if (emCache) return emCache;

      const linkGerado = await gerador.gerar(urlProduto);
      await redisConnection.set(chave, linkGerado);
      return linkGerado;
    },
  };
}
