/*
 * Backup do PostgreSQL local (container docker compose) via pg_dump em formato
 * custom (-Fc): comprimido e restaurável seletivamente com pg_restore, formato
 * recomendado pela própria documentação do Postgres pra esse tipo de uso.
 *
 * Uso:
 *   pnpm run db:backup
 *   pnpm run db:backup -- --label antes-da-migration-xyz
 *
 * Requer: `docker compose up -d postgres` já rodando (mesmo serviço usado por
 * `pnpm db:up`). Não precisa de pg_dump instalado na máquina host — roda dentro
 * do container, igual o resto do fluxo Docker deste projeto.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, openSync, closeSync, statSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const labelIndex = args.indexOf("--label");
const label = labelIndex !== -1 ? args[labelIndex + 1] : null;

const DB_USER = process.env.POSTGRES_USER || "gundam";
const DB_NAME = process.env.POSTGRES_DB || "gundam_portal";
const SERVICE = "postgres";

const backupsDir = resolve(process.cwd(), "backups");
if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const safeLabel = label ? `_${label.replace(/[^a-zA-Z0-9_-]/g, "-")}` : "";
const filename = `${timestamp}${safeLabel}.dump`;
const outputPath = resolve(backupsDir, filename);

console.log(`Gerando backup de "${DB_NAME}" (usuário "${DB_USER}") via docker compose...`);

const fd = openSync(outputPath, "w");
const result = spawnSync(
  "docker",
  ["compose", "exec", "-T", SERVICE, "pg_dump", "-U", DB_USER, "-d", DB_NAME, "--format=custom", "--no-owner", "--no-privileges"],
  { stdio: ["ignore", fd, "inherit"] },
);
closeSync(fd);

if (result.error || result.status !== 0) {
  console.error("");
  console.error("Falha ao gerar backup. Confirme que o Postgres está rodando: pnpm db:up");
  if (result.error) console.error(result.error.message);
  process.exitCode = 1;
  process.exit(1);
}

const sizeMb = (statSync(outputPath).size / (1024 * 1024)).toFixed(2);
if (Number(sizeMb) === 0) {
  console.error(`Aviso: o arquivo gerado está vazio (0 MB) — provavelmente o comando falhou silenciosamente. Confira a saída acima.`);
  process.exitCode = 1;
  process.exit(1);
}

console.log(`Backup salvo em: ${outputPath} (${sizeMb} MB)`);
console.log(`Pra restaurar: pnpm run db:restore -- "${outputPath}"`);
