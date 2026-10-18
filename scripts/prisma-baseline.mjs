#!/usr/bin/env node
/* Baseline do histórico de migrations num banco que foi mantido com `prisma db push`.
 *
 * Rode UMA vez no servidor (com backup feito antes). Passos:
 *  1. Confere que o banco está idêntico ao prisma/schema.prisma (`prisma migrate diff --exit-code`).
 *     Se houver qualquer diferença, para sem mexer em nada e mostra o SQL da diferença.
 *  2. Apaga os registros antigos de _prisma_migrations (nomes antigos, sem zero à esquerda).
 *  3. Marca todas as migrations de prisma/migrations como aplicadas (`prisma migrate resolve --applied`).
 *  4. Mostra `prisma migrate status`, que deve dizer que está tudo em dia.
 * Nenhuma tabela de dados é alterada: só o histórico em _prisma_migrations.
 *
 *   node scripts/prisma-baseline.mjs          # só confere e mostra o que faria
 *   node scripts/prisma-baseline.mjs --yes    # executa */
import "dotenv/config";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const apply = process.argv.includes("--yes");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definido (.env).");
  process.exit(1);
}

const prisma = (args, opts = {}) => spawnSync("pnpm", ["exec", "prisma", ...args], { stdio: "inherit", ...opts });

const dir = "prisma/migrations";
const migrations = readdirSync(dir)
  .filter((name) => statSync(join(dir, name)).isDirectory())
  .sort();

console.log(`1/4 Conferindo se o banco bate com prisma/schema.prisma...`);
const diff = prisma(["migrate", "diff", "--from-url", url, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"], { stdio: "pipe" });
if (diff.status === 2) {
  console.error("O banco NÃO está igual ao schema. Nada foi alterado. Diferença:");
  prisma(["migrate", "diff", "--from-url", url, "--to-schema-datamodel", "prisma/schema.prisma", "--script"]);
  process.exit(2);
}
if (diff.status !== 0) {
  console.error(String(diff.stderr || diff.stdout));
  process.exit(diff.status ?? 1);
}
console.log("   ok: banco idêntico ao schema.");

if (!apply) {
  console.log(`\nModo conferência. Com --yes, o script vai:\n  - apagar os registros de _prisma_migrations\n  - marcar como aplicadas: ${migrations.join(", ")}`);
  process.exit(0);
}

console.log("2/4 Limpando o histórico antigo de _prisma_migrations...");
const { PrismaClient } = await import("@prisma/client");
const client = new PrismaClient();
try {
  await client.$executeRawUnsafe(`DELETE FROM "_prisma_migrations"`);
} catch (err) {
  if (!/does not exist/i.test(String(err?.message))) throw err;
} finally {
  await client.$disconnect().catch(() => {});
}

console.log(`3/4 Marcando ${migrations.length} migrations como aplicadas...`);
for (const name of migrations) {
  const res = prisma(["migrate", "resolve", "--applied", name]);
  if (res.status !== 0) process.exit(res.status ?? 1);
}

console.log("4/4 Status final:");
const status = prisma(["migrate", "status"]);
process.exit(status.status ?? 0);
