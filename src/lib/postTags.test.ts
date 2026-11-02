import { describe, expect, it } from "vitest";
import { POST_TAG_LIMIT, normalizePostTags } from "./postTags";

describe("normalizePostTags", () => {
  it("trata grafias diferentes como a mesma hashtag", () => {
    expect(normalizePostTags(["#Simulador", "simulador", " Simuladór "])).toEqual(["simulador"]);
  });

  it("transforma espaços em hífen e descarta entradas vazias", () => {
    expect(normalizePostTags(["Veda System", "", "#"])).toEqual(["veda-system"]);
  });

  it("descarta hashtags genéricas, que não servem de filtro", () => {
    expect(normalizePostTags(["GundamCardGame", "AnaheimHub", "Metagame"])).toEqual(["metagame"]);
  });

  it("respeita o limite de hashtags", () => {
    expect(normalizePostTags(["a", "b", "c", "d", "e", "f", "g"])).toHaveLength(POST_TAG_LIMIT);
  });

  it("devolve lista vazia quando o valor não é uma lista", () => {
    expect(normalizePostTags(undefined)).toEqual([]);
    expect(normalizePostTags("simulador")).toEqual([]);
  });
});
