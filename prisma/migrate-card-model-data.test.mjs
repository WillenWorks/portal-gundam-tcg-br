import { describe, expect, it } from "vitest";
import { pickRepresentativePrint } from "./migrate-card-model-data.mjs";

const print = (overrides) => ({
  id: "id", nameEn: "Nome", rarity: "Common", createdAt: new Date("2026-01-01"), ...overrides,
});

describe("pickRepresentativePrint", () => {
  it("escolhe a única impressão sem parênteses no nome bruto", () => {
    const prints = [
      print({ id: "a", nameEn: "A Show of Resolve", rarity: "Uncommon" }),
      print({ id: "b", nameEn: "A Show of Resolve (U+)", rarity: "U+" }),
      print({ id: "c", nameEn: "A Show of Resolve (SP) (U+)", rarity: "U+" }),
    ];
    expect(pickRepresentativePrint(prints).id).toBe("a");
  });

  it("caso real: raridade igual entre regular e promo (não basta olhar só raridade)", () => {
    // "Ball (Judge Pack 02)" tem raridade "Common", igual à regular — só o nome
    // denuncia que é uma variante. Por isso o nome tem que ser o sinal principal.
    const prints = [
      print({ id: "regular", nameEn: "Ball", rarity: "Common" }),
      print({ id: "promo", nameEn: "Ball  (Judge Pack 02)", rarity: "Common" }),
    ];
    expect(pickRepresentativePrint(prints).id).toBe("regular");
  });

  it("quando o nome oficial tem parênteses legítimos (não é sufixo de variante), usa raridade como critério", () => {
    // "Duel Gundam (Assault Shroud)" tem parênteses fazendo parte do nome oficial da
    // unidade — nenhuma impressão fica "sem parênteses". Cai pro critério de raridade.
    const prints = [
      print({ id: "regular", nameEn: "Duel Gundam (Assault Shroud)", rarity: "Rare" }),
      print({ id: "altart", nameEn: "Duel Gundam (Assault Shroud) (LR+)", rarity: "LR+" }),
    ];
    expect(pickRepresentativePrint(prints).id).toBe("regular");
  });

  it("caso real: mesma carta reimpressa em produto diferente, ambas sem parênteses e raridade base", () => {
    // Gundam Deathscythe GD01-025 saiu no booster GD01 e também no Deck Build Box —
    // as duas impressões são "LR" puro, sem sufixo. Desempate por mais antiga.
    const prints = [
      print({ id: "deckbuildbox", nameEn: "Gundam Deathscythe", rarity: "LR", createdAt: new Date("2026-03-01") }),
      print({ id: "booster", nameEn: "Gundam Deathscythe", rarity: "LR", createdAt: new Date("2026-01-01") }),
    ];
    expect(pickRepresentativePrint(prints).id).toBe("booster");
  });

  it("quando nenhuma impressão tem raridade regular, usa a mais antiga", () => {
    const prints = [
      print({ id: "novo", nameEn: "Token (Championship Pack)", rarity: "Promo", createdAt: new Date("2026-02-01") }),
      print({ id: "antigo", nameEn: "Token (Launch Event)", rarity: "Promo", createdAt: new Date("2026-01-01") }),
    ];
    expect(pickRepresentativePrint(prints).id).toBe("antigo");
  });
});
