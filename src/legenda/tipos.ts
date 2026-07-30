export interface ParametrosLegenda {
  titulo: string;
  chamada?: string;
  precoOriginal?: number;
  precoPromocional?: number;
  cupom?: string;
  /** Link de ativação do cupom no anúncio (Shopee via grupo monitorado, quando distinto do link do produto) — ver ProdutoRow.linkCupom. */
  linkCupom?: string;
  precoNoPix?: boolean;
  linkAfiliado: string;
}
