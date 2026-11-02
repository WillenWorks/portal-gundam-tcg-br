import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_USER_SELECT } from "./publicUser";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe("dados públicos de conta", () => {
  it("o select público não inclui campo privado", () => {
    for (const field of ["passwordHash", "email", "googleId", "tokenVersion", "emailVerifiedAt"]) {
      expect(PUBLIC_USER_SELECT).not.toHaveProperty(field);
    }
  });

  it("nenhuma rota carrega a linha inteira do usuário como relação", () => {
    const offenders = sourceFiles("server").flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) => (/\b(user|author)\s*:\s*true\b/.test(line) ? [`${file}:${index + 1}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});
