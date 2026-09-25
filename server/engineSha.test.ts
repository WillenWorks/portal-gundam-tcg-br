import { describe, expect, it } from "vitest";
import { engineShaFromEnv } from "./engineSha.ts";

describe("engineShaFromEnv", () => {
  it("ENGINE_SHA explícito vence", () => {
    expect(engineShaFromEnv({ ENGINE_SHA: "abc1234", RENDER_GIT_COMMIT: "ffffffffffffffff" })).toBe("abc1234");
  });

  it("no Render (sem .git no runtime) usa o commit do deploy, encurtado como o git rev-parse --short", () => {
    expect(engineShaFromEnv({ RENDER_GIT_COMMIT: "a5b2b4f682d29efe63e2cd39022f4829c4c131a4" })).toBe("a5b2b4f");
  });

  it("sem nenhuma das duas, devolve undefined (o boot tenta o git)", () => {
    expect(engineShaFromEnv({})).toBeUndefined();
    expect(engineShaFromEnv({ RENDER_GIT_COMMIT: "" })).toBeUndefined();
  });
});
