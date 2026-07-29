export interface CanalRow {
  id: number;
  nome: string | null;
  tipo: "whatsapp" | "telegram";
  identificadorGrupo: string;
  categoriasPermitidas: string[] | null;
  fontesPermitidas: string[] | null;
  gruposMonitoradosPermitidos: string[] | null;
  descontoMinimo: number;
  intervaloMinimoMinutos: number;
  ativo: boolean;
}

export interface NichoRow {
  id: string;
  nome: string;
  ativo: boolean;
  categoriaIds: string[];
}

export const FONTES_CANAL = [
  { valor: "mercado_livre", rotulo: "Mercado Livre" },
  { valor: "shopee", rotulo: "Shopee" },
  { valor: "monitorados", rotulo: "Grupos monitorados" },
] as const;
