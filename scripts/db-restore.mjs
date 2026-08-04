/*
 * Restaura um backup gerado por scripts/db-backup.mjs. SOBRESCREVE o conteúdo
 * atual do banco (--clean --if-exists no pg_restore) — pede confirmação explícita
 * antes de rodar, a menos que --force seja passado (ex: uso em script automatizado).
 *
 * Uso:
 *   pnpm run db:restore -- backups/2026-08-03T22-10-00-000Z.dump
 *   pnpm run db:restore -- backups/2026-08-03T22-10-00-000Z.dump --force
 *
 * O `--` depois de `db:restore` é necessário pro pnpm repassar os argumentos
 * pro script em vez de tentar interpretá-los como flags do próprio pnpm.
 */
import { spawnSync } from "node:child_process";
import { existsSync, openSync, closeSync } from "node:fs";
import { resolve } from "node:path";
import readline from "node:readline";

const args = process.argv.slice(2);
const force = args.includes("--force");
const filePath = args.find((value) => !value.startsWith("--"));

if (!filePath) {
  console.error('Uso: pnpm run db:restore -- "<caminho-do-backup.dump>" [--force]');
  process.exit(1);
}

const resolvedPath = resolve(process.cwd(), filePath);
if (!existsSync(resolvedPath)) {
  console.error(`Arquivo não encontrado: ${resolvedPath}`);
  process.exit(1);
}

const DB_USER = process.env.POSTGRES_USER || "gundam";
const DB_NAME = process.env.POSTGRES_DB || "gundam_portal";
const SERVICE = "postgres";

async function confirm() {
  if (force) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => {
    rl.question(
      `Isso vai SOBRESCREVER todo o conteúdo do banco "${DB_NAME}" com "${filePath}". ` +
      `Não tem desfazer depois — se quiser guardar o estado atual, rode "pnpm run db:backup" antes. ` +
      `Digite "sim" pra confirmar: `,
      res,
    );
  });
  rl.close();
  return answer.trim().toLowerCase() === "sim";
}

const confirmed = await confirm();
if (!confirmed) {
  console.log("Cancelado — nada foi alterado.");
  process.exit(0);
}

console.log(`Restaurando "${filePath}" em "${DB_NAME}"...`);

const fd = openSync(resolvedPath, "r");
const result = spawnSync(
  "docker",
  ["compose", "exec", "-T", SERVICE, "pg_restore", "-U", DB_USER, "-d", DB_NAME, "--clean", "--if-exists", "--no-owner", "--no-privileges"],
  { stdio: [fd, "inherit", "inherit"] },
);
closeSync(fd);

if (result.error || result.status !== 0) {
  console.error("");
  console.error("Restore terminou com erro — revise a saída acima antes de continuar usando o banco.");
  process.exitCode = 1;
  process.exit(1);
}

console.log("Restore concluído. Rode `pnpm run catalog:apitcg:check` pra validar o catálogo, se aplicável.");
