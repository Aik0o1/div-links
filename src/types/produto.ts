export interface DadosEstruturados {
  titulo?: string;
  precoOriginal?: number;
  precoPromocional?: number;
  imagemUrl?: string;
  cupom?: string;
}

export interface ProdutoBruto {
  fonte: string;
  urlOriginal: string;
  capturadoEm: string;
  /** Texto livre, presente quando a fonte não retorna dados estruturados (grupos de WhatsApp/Telegram). */
  textoOriginal?: string;
  /** Preenchido quando a fonte já retorna dados estruturados (APIs oficiais), dispensando o parsing por LLM. */
  dadosEstruturados?: DadosEstruturados;
}

export interface ProdutoNormalizado {
  fonte: string;
  urlOriginal: string;
  titulo?: string;
  precoOriginal?: number;
  precoPromocional?: number;
  imagemUrl?: string;
  cupom?: string;
}

export interface FonteDeProdutos {
  nome: string;
  buscar(): Promise<ProdutoBruto[]>;
}
