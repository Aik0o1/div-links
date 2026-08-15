// Script one-off — NÃO é uma migration numerada (cria dado específico deste
// deployment: a conta do Victor, dono de todo o dado que já existia antes
// do sistema virar multi-tenant). Roda depois de 022_usuario_id_expand.sql,
// antes de 023_usuario_id_contract.sql.
//
// Rodar UMA VEZ só: `BACKFILL_SENHA=... BACKFILL_EMAIL=... tsx src/db/backfillContaInicial.ts`
// (senha via env var, nunca em argv — não fica no histórico do shell).
// A parte de UPDATE é idempotente (WHERE usuario_id IS NULL), mas o INSERT
// do usuário não é — rodar 2x cria uma segunda conta (o índice único de
// email barra, então falha alto, não duplica silenciosamente).
//
// Confirma ao final: `SELECT count(*) FROM <tabela> WHERE usuario_id IS NULL`
// deve dar 0 em todas as 7 tabelas antes de aplicar a migration 023.

import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

const TABELAS = [
  "produtos",
  "canais_destino",
  "nichos",
  "cupons_capturados",
  "disparos",
  "cupons_disparos",
  "configuracoes",
] as const;

async function main() {
  const email = process.env.BACKFILL_EMAIL;
  const senha = process.env.BACKFILL_SENHA;
  if (!email || !senha) {
    throw new Error("Defina BACKFILL_EMAIL e BACKFILL_SENHA (env vars, nunca em argv) antes de rodar.");
  }
  if (senha.length < 8) {
    throw new Error("BACKFILL_SENHA precisa ter pelo menos 8 caracteres.");
  }

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const senhaHash = await bcrypt.hash(senha, 12);
    const { rows } = await cliente.query(
      "INSERT INTO usuarios (email, senha_hash, nome) VALUES ($1, $2, $3) RETURNING id",
      [email, senhaHash, "Victor"],
    );
    const usuarioId: number = rows[0].id;
    console.log(`conta criada: usuario_id=${usuarioId}, email=${email}`);

    for (const tabela of TABELAS) {
      const resultado = await cliente.query(
        `UPDATE ${tabela} SET usuario_id = $1 WHERE usuario_id IS NULL`,
        [usuarioId],
      );
      console.log(`${tabela}: ${resultado.rowCount} linha(s) migrada(s)`);
    }

    await cliente.query("COMMIT");
    console.log("backfill concluído.");
  } catch (err) {
    await cliente.query("ROLLBACK");
    throw err;
  } finally {
    cliente.release();
  }

  await pool.end();
}

main().catch((err) => {
  console.error("falha no backfill:", err);
  process.exit(1);
});
