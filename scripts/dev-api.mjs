import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";

function runStep(label, args) {
  const cmd = isWindows ? `pnpm ${args.join(" ")}` : "pnpm";

  console.log(`\n[dev:api] ${label}...`);
  console.log(`[dev:api] > ${isWindows ? cmd : `pnpm ${args.join(" ")}`}`);

  const result = isWindows
    ? spawnSync(cmd, {
        shell: true,
        env: process.env,
        encoding: "utf-8",
      })
    : spawnSync("pnpm", args, {
        shell: false,
        env: process.env,
        encoding: "utf-8",
      });

  if (result.error) {
    console.error(`[dev:api] Falha ao executar o comando: ${result.error.message}`);
    process.exit(1);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;

    if (output.includes("P1001")) {
      console.error("\n[dev:api] Não foi possível alcançar o PostgreSQL.");
      console.error("[dev:api] Suba o banco primeiro com `pnpm db:up` ou aponte DATABASE_URL para um Postgres ativo.");
    }

    console.error(`\n[dev:api] Etapa falhou: ${label}`);
    console.error(`[dev:api] Exit code: ${result.status ?? 1}`);
    process.exit(result.status ?? 1);
  }
}

runStep("Gerando Prisma Client", ["run", "prisma:generate"]);
runStep("Sincronizando schema com o banco", ["run", "prisma:push"]);
runStep("Subindo API local", ["run", "dev:api:raw"]);
