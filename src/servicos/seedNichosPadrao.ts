import * as nichosRepo from "../repositorios/nichos.js";

// Mesmo conjunto que o Victor tem hoje (era seed de migration antes de
// virar por-tenant — ver migrations 003/005/006/020) — todo tenant novo
// começa com essa base, editável depois pela aba Nichos como qualquer
// outro nicho.
const NICHOS_PADRAO: Array<{ id: string; nome: string; categoriaIds: string[] }> = [
  { id: "geral", nome: "Geral (todas as categorias)", categoriaIds: [] },
  { id: "tecnologia", nome: "Tecnologia", categoriaIds: ["MLB1051", "MLB1000", "MLB1648"] },
  { id: "beleza", nome: "Beleza", categoriaIds: ["MLB1246"] },
  { id: "moda", nome: "Moda", categoriaIds: ["MLB1430", "MLB3937"] },
  { id: "casa", nome: "Casa", categoriaIds: ["MLB1574", "MLB5726"] },
  { id: "gamer", nome: "Gamer", categoriaIds: ["MLB1144"] },
  { id: "maternidade", nome: "Maternidade", categoriaIds: ["MLB1384"] },
  { id: "pet", nome: "Pet", categoriaIds: ["MLB1071"] },
];

/** Chamado uma vez no signup (ver rotas/auth.ts) — dá pro tenant novo o mesmo ponto de partida que o Victor tinha. */
export async function seedNichosPadrao(usuarioId: number): Promise<void> {
  for (const nicho of NICHOS_PADRAO) {
    await nichosRepo.criar(usuarioId, nicho);
  }
}
