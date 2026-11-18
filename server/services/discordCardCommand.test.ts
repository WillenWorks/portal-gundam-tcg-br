/* eslint-disable @typescript-eslint/no-explicit-any -- banco em memória: linhas soltas, como o Prisma devolve */
import { describe, expect, it } from "vitest";
import { autocompleteChoices, cardEmbed, handleCardCommand, rankCardMatches } from "./discordCardCommand";

const gelgoog = {
  code: "GD01-030",
  nameEn: "Gelgoog",
  namePt: "Gelgoog",
  cardType: "UNIT",
  color: "Green",
  level: 4,
  cost: 3,
  ap: 4,
  hp: 4,
  traits: ["Zeon"],
  trait: null,
  linkText: "[Char Aznable]",
  effectPt: "<Implantar> Compre 1 carta.",
  effectEn: "<Deploy> Draw 1.",
  legalityStatus: "legal",
  prints: [{ imageLargeUrl: "/uploads/cards/gd01-030.webp", imageMediumUrl: null, imageUrl: null }],
};
const models = [
  gelgoog,
  { ...gelgoog, code: "GD02-010", nameEn: "Gelgoog Marine", namePt: "Gelgoog Marine" },
  { ...gelgoog, code: "ST01-001", nameEn: "Gundam", namePt: "Gundam" },
];

function fakePrisma() {
  const hit = (m: any, where: any) => {
    if (where.code && typeof where.code === "string") return m.code === where.code;
    const q = String(where.OR?.[0]?.code?.contains ?? "").toLowerCase();
    return [m.code, m.nameEn, m.namePt].some((v) => String(v).toLowerCase().includes(q));
  };
  return {
    cardModel: {
      findMany: async ({ where }: any) => models.filter((m) => hit(m, where)),
      findFirst: async ({ where }: any) => models.find((m) => hit(m, where)) ?? null,
    },
  } as any;
}

const interaction = (type: number, value: string) => ({ type, data: { name: "carta", options: [{ name: "nome", value, focused: true }] } });

describe("busca do /carta", () => {
  it("código exato primeiro, depois nome igual, depois nome que começa com o texto", () => {
    const rows = [
      { code: "GD02-010", nameEn: "Gelgoog Marine", namePt: null },
      { code: "GD01-030", nameEn: "Gelgoog", namePt: null },
      { code: "GD03-001", nameEn: "Zaku (Gelgoog parts)", namePt: null },
    ];
    expect(rankCardMatches(rows, "gelgoog").map((r) => r.code)).toEqual(["GD01-030", "GD02-010", "GD03-001"]);
    expect(rankCardMatches(rows, "gd03-001")[0].code).toBe("GD03-001");
  });

  it("autocomplete mostra os dois nomes e corta em 100 caracteres", () => {
    const [choice, long] = autocompleteChoices([
      { code: "GD01-001", nameEn: "Gundam", namePt: "Gundam (Arma)" },
      { code: "GD01-002", nameEn: "x".repeat(120), namePt: null },
    ]);
    expect(choice).toEqual({ name: "Gundam (Arma) / Gundam (GD01-001)", value: "GD01-001" });
    expect(long.name).toHaveLength(100);
  });
});

describe("cardEmbed", () => {
  it("efeito em português, atributos, link e imagem com endereço completo", () => {
    const embed = cardEmbed({ ...gelgoog, image: "/uploads/cards/gd01-030.webp" }, "https://anaheimhub.com");
    expect(embed.title).toBe("Gelgoog · GD01-030");
    expect(embed.url).toBe("https://anaheimhub.com/cards/GD01-030");
    expect(embed.description).toBe("<Implantar> Compre 1 carta.");
    expect(embed.fields).toEqual(
      expect.arrayContaining([
        { name: "Tipo", value: "Unidade", inline: true },
        { name: "Cor", value: "Verde", inline: true },
        { name: "Atributos", value: "Nível 4 · Custo 3 · AP 4 · HP 4", inline: true },
        { name: "Link", value: "[Char Aznable]", inline: false },
      ]),
    );
    expect(embed.image).toEqual({ url: "https://anaheimhub.com/uploads/cards/gd01-030.webp" });
    expect(embed.color).toBe(0x22c55e);
  });

  it("sem tradução cai no inglês; prévia é sinalizada", () => {
    const embed = cardEmbed({ ...gelgoog, effectPt: null, legalityStatus: "preview" }, "https://anaheimhub.com");
    expect(embed.description).toBe("<Deploy> Draw 1.");
    expect(embed.footer.text).toContain("Prévia");
  });
});

describe("handleCardCommand", () => {
  it("autocomplete devolve até 25 opções com o código como valor", async () => {
    const reply: any = await handleCardCommand(fakePrisma(), interaction(4, "gelg"), "https://anaheimhub.com");
    expect(reply.type).toBe(8);
    expect(reply.data.choices.map((c: any) => c.value)).toEqual(["GD01-030", "GD02-010"]);
  });

  it("comando com o código escolhido responde em público com o embed", async () => {
    const reply: any = await handleCardCommand(fakePrisma(), interaction(2, "GD01-030"), "https://anaheimhub.com");
    expect(reply.type).toBe(4);
    expect(reply.data.flags).toBeUndefined();
    expect(reply.data.embeds[0].title).toBe("Gelgoog · GD01-030");
  });

  it("texto digitado sem escolher usa a melhor correspondência", async () => {
    const reply: any = await handleCardCommand(fakePrisma(), interaction(2, "gundam"), "https://anaheimhub.com");
    expect(reply.data.embeds[0].title).toBe("Gundam · ST01-001");
  });

  it("nada encontrado → resposta só para quem pediu, com link de busca", async () => {
    const reply: any = await handleCardCommand(fakePrisma(), interaction(2, "inexistente"), "https://anaheimhub.com");
    expect(reply.data.flags).toBe(64);
    expect(reply.data.content).toContain("https://anaheimhub.com/database?q=inexistente");
  });

  it("outro comando não é com ele", async () => {
    expect(await handleCardCommand(fakePrisma(), { type: 2, data: { name: "outro" } }, "https://anaheimhub.com")).toBeNull();
  });
});
