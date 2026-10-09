/*
 * Versão das REGRAS para o treino: hash do conteúdo do motor (`engine/**` fora de `bot/`) e das cartas
 * (`content/**`). Antes era o `git rev-parse HEAD` do repositório inteiro, então qualquer commit de UI invalidava
 * um modelo treinado — e dois motores diferentes podiam ter o mesmo "sha" num checkout sujo.
 * `TRAIN_ENGINE_SHA` força um valor (ex.: CI que já calculou).
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const RULE_DIRS = ["src/modules/simulator/engine", "src/modules/simulator/content"];
const EXCLUDED_DIRS = new Set(["bot", "node_modules"]);
const HASHED_EXTENSIONS = new Set([".ts", ".json"]);

function listRuleFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walk(full);
      } else if (HASHED_EXTENSIONS.has(path.extname(entry.name)) && !/\.test\.ts$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  for (const dir of RULE_DIRS) {
    const abs = path.join(root, dir);
    if (fs.existsSync(abs)) walk(abs);
  }
  return files.sort();
}

export function computeEngineSha(root, env = process.env) {
  if (env.TRAIN_ENGINE_SHA) return env.TRAIN_ENGINE_SHA;
  const hash = createHash("sha256");
  for (const file of listRuleFiles(root)) {
    hash.update(path.relative(root, file).split(path.sep).join("/"));
    hash.update("\0");
    // CRLF/LF não muda regra: normaliza para o hash bater entre Windows e o runner Linux.
    hash.update(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
    hash.update("\0");
  }
  return `rules-${hash.digest("hex").slice(0, 12)}`;
}
