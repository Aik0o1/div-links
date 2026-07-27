export interface GeradorDeLinkAfiliado {
  plataforma: string;
  gerar(urlProduto: string): Promise<string>;
}
