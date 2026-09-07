import { describe, expect, it } from "vitest";
import { computeDeckPilotCoverage, parsePilotLinkNames, type PilotCoverageCard } from "./deck-pilot-coverage.ts";
import type { CardDef } from "@/modules/simulator/engine/types";
import { buildSt01MainDeck } from "@/modules/simulator/fixtures/st01Deck";
import { buildSt02MainDeck } from "@/modules/simulator/fixtures/st02Deck";
import { buildSt03MainDeck } from "@/modules/simulator/fixtures/st03Deck";
import { buildSt04MainDeck } from "@/modules/simulator/fixtures/st04Deck";

/** Achata um CardDef do motor no formato mínimo que o check consome. Reproduz o
 *  que o deckbuilder faz com CardRecord (linkText/pilotName vindos do CardModel). */
function fromDef(def: CardDef): PilotCoverageCard {
  const linkText = def.link
    ? def.link.kind === "pilotName"
      ? def.link.values.map((v) => `[${v}]`).join("/")
      : `(${def.link.values.join("/")}) Trait`
    : null;
  return { code: def.code, name: def.nameEn, cardType: def.cardType, linkText, pilotName: def.pilotMode?.pilotName ?? null };
}

const guntank: PilotCoverageCard = { code: "ST01-004", name: "Guntank", cardType: "UNIT", linkText: "[Hayato Kobayashi]" };
const thoroughlyDamaged: PilotCoverageCard = { code: "ST01-012", name: "Thoroughly Damaged", cardType: "COMMAND", pilotName: "Hayato Kobayashi" };
const hayatoPilot: PilotCoverageCard = { code: "X-HAYATO", name: "Hayato Kobayashi", cardType: "PILOT" };

describe("parsePilotLinkNames", () => {
  it("extrai um nome de link por piloto", () => {
    expect(parsePilotLinkNames("[Amuro Ray]")).toEqual(["Amuro Ray"]);
  });

  it("extrai dois nomes de um link '[A]/[B]'", () => {
    expect(parsePilotLinkNames("[Amuro Ray]/[Char Aznable]")).toEqual(["Amuro Ray", "Char Aznable"]);
  });

  it("link por trait não tem colchetes -> lista vazia", () => {
    expect(parsePilotLinkNames("(OZ) Trait")).toEqual([]);
    expect(parsePilotLinkNames(null)).toEqual([]);
    expect(parsePilotLinkNames(undefined)).toEqual([]);
  });
});

describe("computeDeckPilotCoverage", () => {
  it("Guntank sozinha (link [Hayato Kobayashi], sem fonte) -> aviso", () => {
    const gaps = computeDeckPilotCoverage([guntank]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].unitCode).toBe("ST01-004");
    expect(gaps[0].pilotNames).toEqual(["Hayato Kobayashi"]);
    expect(gaps[0].message).toContain("Hayato Kobayashi");
  });

  it("Guntank + ST01-012 (Command/Pilot Hayato Kobayashi) -> sem aviso", () => {
    expect(computeDeckPilotCoverage([guntank, thoroughlyDamaged])).toHaveLength(0);
  });

  it("Guntank + Piloto nativo 'Hayato Kobayashi' -> sem aviso", () => {
    expect(computeDeckPilotCoverage([guntank, hayatoPilot])).toHaveLength(0);
  });

  it("Command/Pilot sem pilotName mas com 【Pilot】[X] no texto -> conta como fonte", () => {
    const cmd: PilotCoverageCard = { code: "ST01-012", name: "Thoroughly Damaged", cardType: "COMMAND", effect: "【Main】Escolha 1 Unidade inimiga em Rest.\n【Pilot】[Hayato Kobayashi]" };
    expect(computeDeckPilotCoverage([guntank, cmd])).toHaveLength(0);
  });

  it("Unit com link por trait nunca gera aviso (é trait, não nome)", () => {
    const leo: PilotCoverageCard = { code: "ST02-007", name: "Leo", cardType: "UNIT", linkText: "(OZ) Trait" };
    expect(computeDeckPilotCoverage([leo])).toHaveLength(0);
  });

  it("4 cópias da mesma Unit descoberta -> 1 aviso, não 4", () => {
    const gaps = computeDeckPilotCoverage([guntank, guntank, guntank, guntank]);
    expect(gaps).toHaveLength(1);
  });

  it("link '[A]/[B]' com fonte só de B -> sem aviso", () => {
    const unit: PilotCoverageCard = { code: "U-AB", name: "Test Unit", cardType: "UNIT", linkText: "[Amuro Ray]/[Char Aznable]" };
    const charPilot: PilotCoverageCard = { code: "X-CHAR", name: "Char Aznable", cardType: "PILOT" };
    expect(computeDeckPilotCoverage([unit, charPilot])).toHaveLength(0);
  });

  it("casa por substring: fonte 'Char Aznable (Neo Zeon)' cobre link '[Char Aznable]'", () => {
    const unit: PilotCoverageCard = { code: "U-C", name: "Sazabi", cardType: "UNIT", linkText: "[Char Aznable]" };
    const pilot: PilotCoverageCard = { code: "X", name: "Char Aznable (Neo Zeon)", cardType: "PILOT" };
    expect(computeDeckPilotCoverage([unit, pilot])).toHaveLength(0);
  });

  it.each([
    ["ST01", buildSt01MainDeck],
    ["ST02", buildSt02MainDeck],
    ["ST03", buildSt03MainDeck],
    ["ST04", buildSt04MainDeck],
  ])("deck oficial %s é internamente coerente -> zero avisos", (_label, build) => {
    const cards = build().map(fromDef);
    expect(computeDeckPilotCoverage(cards)).toHaveLength(0);
  });
});
