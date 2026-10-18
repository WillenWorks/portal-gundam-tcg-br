#!/usr/bin/env node
/* Sincroniza o schema do banco no deploy.
 *
 * - Banco já "baselined" (tem a migration 0021_sync_schema_db_push registrada em
 *   _prisma_migrations): roda `prisma migrate deploy`, que aplica só as migrations novas, em ordem.
 * - Banco ainda não baselined (o caso da produção até rodar scripts/prisma-baseline.mjs uma vez):
 *   continua com `prisma db push`, como antes.
 *
 * Assim o deploy funciona antes e depois do baseline, sem passo manual no meio.
 *   node scripts/prisma-sync.mjs */
import "dotenv/config";
import { spawnSync } from "node:child_process";

export const BASELINE_MARK = "0021_sync_schema_db_push";

function run(args) {
  const res = spawnSync("pnpm", ["exec", "prisma", ...args], { stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

async function isBaselined() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL`,
      BASELINE_MARK,
    );
    return rows.length > 0;
  } catch {
    return false; // sem tabela _prisma_migrations
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

run(["generate"]);
if (await isBaselined()) {
  console.log("prisma-sync: banco com histórico de migrations — rodando `prisma migrate deploy`.");
  run(["migrate", "deploy"]);
} else {
  console.log("prisma-sync: banco ainda sem baseline — mantendo `prisma db push` (rode scripts/prisma-baseline.mjs para migrar).");
  run(["db", "push", "--skip-generate"]);
}
