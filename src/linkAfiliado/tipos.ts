export interface GeradorDeLinkAfiliado {
  plataforma: string;
  gerar(usuarioId: number, urlProduto: string): Promise<string>;
}
