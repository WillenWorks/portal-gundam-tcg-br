import { describe, expect, it } from "vitest";
import { isLocalDatabase, seedPassword } from "./seedPassword.mjs";

const LOCAL = "postgresql://postgres:postgres@localhost:5432/portal";
const REMOTE = "postgresql://portal:segredo@anaheimhub.com:5432/portal";

describe("seedPassword", () => {
  it("usa a senha definida em qualquer banco", () => {
    expect(seedPassword("SENHA", "padrao", { SENHA: "forte", DATABASE_URL: REMOTE, NODE_ENV: "production" })).toBe("forte");
  });

  it("aceita a senha padrão só em banco local", () => {
    expect(seedPassword("SENHA", "padrao", { DATABASE_URL: LOCAL })).toBe("padrao");
    expect(seedPassword("SENHA", "padrao", { DATABASE_URL: "postgresql://u:p@127.0.0.1/portal" })).toBe("padrao");
  });

  it("recusa a senha padrão em banco remoto, sem banco definido ou em produção", () => {
    expect(() => seedPassword("SENHA", "padrao", { DATABASE_URL: REMOTE })).toThrow("SENHA");
    expect(() => seedPassword("SENHA", "padrao", {})).toThrow("SENHA");
    expect(() => seedPassword("SENHA", "padrao", { DATABASE_URL: LOCAL, NODE_ENV: "production" })).toThrow("SENHA");
    expect(() => seedPassword("SENHA", "padrao", { SENHA: "", DATABASE_URL: REMOTE })).toThrow("SENHA");
  });

  it("não confunde um host remoto que só contém a palavra localhost", () => {
    expect(isLocalDatabase("postgresql://u:p@localhost.exemplo.com/portal")).toBe(false);
    expect(isLocalDatabase("não é url")).toBe(false);
    expect(isLocalDatabase(undefined)).toBe(false);
  });
});
