import { Router } from "express";
import * as cuponsRepo from "../../repositorios/cupons.js";
import { extrairCupons, detectarPlataformaCupom } from "../../servicos/parsearCupons.js";

export const rotaCupons = Router();

rotaCupons.get("/", async (req, res) => {
  const limite = req.query.limite ? Number(req.query.limite) : 100;
  const cupons = await cuponsRepo.listarRecentes(limite);

  const comDetalhes = await Promise.all(
    cupons.map(async (cupom) => {
      const codigos = extrairCupons(cupom.texto);
      const { plataforma } = detectarPlataformaCupom(cupom.texto);
      const disparos = await cuponsRepo.listarDisparosPorCupom(cupom.id);
      return { ...cupom, codigos, plataforma, disparos };
    }),
  );

  res.json(comDetalhes);
});
