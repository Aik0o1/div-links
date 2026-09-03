import { Router } from "express";
import * as cuponsRepo from "../../repositorios/cupons.js";
import { extrairCupons, detectarPlataformaCupom } from "../../servicos/parsearCupons.js";
import { logger } from "../../config/logger.js";

export const rotaCupons = Router();

async function comDetalhesDeCupom(usuarioId: number, cupom: cuponsRepo.CupomRow) {
  const codigos = extrairCupons(cupom.texto);
  // Cupom criado manualmente já vem com a plataforma escolhida pelo usuário
  // (não tem link de verdade no texto pra detectar, ver inserirManual) — só
  // cai na detecção por texto pro cupom capturado normalmente de um grupo.
  const plataforma = cupom.plataformaManual ?? detectarPlataformaCupom(cupom.texto).plataforma;
  const disparos = await cuponsRepo.listarDisparosPorCupom(usuarioId, cupom.id);
  return { ...cupom, codigos, plataforma, disparos };
}

rotaCupons.get("/", async (req, res) => {
  const limite = req.query.limite ? Number(req.query.limite) : 100;
  const cupons = await cuponsRepo.listarRecentes(req.usuarioId, limite);
  res.json(await Promise.all(cupons.map((c) => comDetalhesDeCupom(req.usuarioId, c))));
});

// Cria cupom(s) direto pelo painel, sem depender de um grupo monitorado —
// mesmo parser de sempre (extrairCupons) valida o texto, então só aceita se
// reconhecer pelo menos um cupom nele (mesmo formato de post de grupo:
// "cupom: CODIGO" + "XX% OFF em R$Y+", por exemplo — várias ocorrências
// nesse padrão numa mensagem só viram uma "lista").
rotaCupons.post("/manual", async (req, res) => {
  const { plataforma, texto } = req.body;

  if (plataforma !== "shopee" && plataforma !== "mercado_livre") {
    res.status(400).json({ erro: "plataforma precisa ser 'shopee' ou 'mercado_livre'" });
    return;
  }
  if (typeof texto !== "string" || !texto.trim()) {
    res.status(400).json({ erro: "texto do cupom é obrigatório" });
    return;
  }
  if (extrairCupons(texto).length === 0) {
    res.status(400).json({
      erro:
        "Não consegui reconhecer nenhum cupom nesse texto. Use o formato \"cupom: CODIGO\" numa linha e o desconto " +
        "na linha seguinte, ex.: \"20% OFF em R$50+\" ou \"R$10 OFF em R$100+\".",
    });
    return;
  }

  try {
    const cupom = await cuponsRepo.inserirManual(req.usuarioId, texto, plataforma);
    if (!cupom) {
      res.status(409).json({ erro: "esse cupom (texto idêntico) já foi criado antes" });
      return;
    }
    res.status(201).json(await comDetalhesDeCupom(req.usuarioId, cupom));
  } catch (err) {
    logger.error({ err }, "falha ao criar cupom manual");
    res.status(500).json({ erro: (err as Error).message });
  }
});

// Apaga todos os cupons capturados desse tenant (histórico de disparos vai
// junto por ON DELETE CASCADE) — pro botão "Apagar tudo" da aba.
rotaCupons.delete("/", async (req, res) => {
  try {
    await cuponsRepo.apagarTodos(req.usuarioId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "falha ao apagar cupons");
    res.status(500).json({ erro: (err as Error).message });
  }
});
