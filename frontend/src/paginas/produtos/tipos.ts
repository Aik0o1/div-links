export interface ProdutoRow {
  id: number;
  fonte: string;
  urlOriginal: string;
  urlAfiliado: string | null;
  titulo: string | null;
  precoOriginal: number | null;
  precoPromocional: number | null;
  imagemUrl: string | null;
  cupom: string | null;
  nicho: string | null;
  chamada: string | null;
  precoNoPix: boolean;
  status: string;
  criadoEm: string;
  /** Id do grupo monitorado (WhatsApp JID ou Telegram chat id) de onde esse produto veio — null pra captura em massa ML/Shopee. */
  grupoOrigemId: string | null;
  /** Nome de exibição do grupo monitorado — só presente se o grupo foi selecionado depois que esse campo passou a ser salvo (ver GruposMonitorados.tsx). */
  grupoOrigemNome: string | null;
}

export interface CanalElegivel {
  id: number;
  nome: string | null;
  tipo: string;
  identificadorGrupo: string;
  elegivel: boolean;
  motivo?: string;
}

export const FONTES_MONITORADAS = new Set([
  "telegram_terceiros",
  "whatsapp_terceiros",
  "telegram_shopee",
  "whatsapp_shopee",
]);

export const ROTULOS_FONTE: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  telegram_terceiros: "Telegram · ML",
  whatsapp_terceiros: "WhatsApp · ML",
  telegram_shopee: "Telegram · Shopee",
  whatsapp_shopee: "WhatsApp · Shopee",
};
