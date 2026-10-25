/* Camada 1 da fase de assertividade, categoria 【When Paired】: para CADA carta com o gatilho, gerado a partir de
 * ALL_EFFECT_SPECS e jogado pelo caminho do jogador — o pareamento oferecido pelas jogadas legais (Unit da carta
 * + Piloto sem efeito, ou Piloto da carta + Unit sem efeito), as decisões pela jogada legal. Controle: a mesma
 * jogada sem o 【When Paired】 da carta. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { placeCard } from "./__testkit__/cardHarness";
import { fingerprint, richBoard, scenarioOpts, settleDecisions, trashMaterialFor } from "./__testkit__/cardScenario";
import type { EffectSpec } from "./effectSpec";
import type { CardDef, GameState } from "./types";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const PAIRED_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger === "When Paired");
const PAIRED_CARDS = [...new Set(PAIRED_SPECS.map((s) => s.cardCode))].sort().filter((code) => ALL_CARD_DEFS[code]);
const TRASH_MATERIAL = trashMaterialFor(PAIRED_SPECS);
const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };
/**
 * O par da carta, montado a partir do que o próprio spec pede: Piloto com o trait/cor/nível do qualificador
 * (【When Paired･(Newtype) Pilot】, "Purple Pilot", "Lv.4 or Higher Pilot") e Unit com o trait/cor que a habilidade do
 * Piloto exige ("If this is a (CB) Unit", "friendly (Marine) Unit"). Sem habilidade própria.
 */
function partnerFor(code: string): { pilot: CardDef; unit: CardDef } {
  const pilotTraits = new Set<string>();
  const unitTraits = new Set<string>();
  let pilotColor: CardDef["color"] = "colorless";
  let unitColor: CardDef["color"] = ST01_CARD_DEFS.GM.color;
  let pilotLevel = 1;
  for (const spec of PAIRED_SPECS.filter((sp) => sp.cardCode === code)) {
    const parts = [...(spec.condition?.predicate.split(";") ?? []), ...(spec.targetFilter?.split(";") ?? [])];
    for (const part of parts) {
      const [key, value = ""] = part.split(":");
      if (key === "pairedPilotHasTrait" || key === "pairedPilotHasAnyTrait") value.split(",").forEach((t) => pilotTraits.add(t));
      if (key === "selfHasTrait" || key === "controllerUnitWithTraitInPlay" || key === "trait") unitTraits.add(value);
      if (key === "pairedPilotColorIs") pilotColor = value as CardDef["color"];
      if (key === "selfColorIs") unitColor = value as CardDef["color"];
      if (key === "pairedPilotLevelAtLeast") pilotLevel = Number(value);
    }
  }
  return {
    pilot: { code: "CA-PILOT", nameEn: "Test Pilot", cardType: "PILOT", color: pilotColor, level: pilotLevel, cost: 1, ap: 1, hp: 1, traits: [...pilotTraits] },
    unit: { ...ST01_CARD_DEFS.GM, code: "CA-UNIT", nameEn: "Test Unit", color: unitColor, traits: [...unitTraits] },
  };
}

/** a carta e o par dela prontos: Unit em campo + Piloto na mão, ou Piloto na mão + Unit em campo */
function readyToPair(code: string): { state: GameState; pilotId: string; unitId: string } {
  const def = ALL_CARD_DEFS[code];
  const partner = partnerFor(code);
  const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 10; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  richBoard(state, "A", TRASH_MATERIAL);
  if (def.cardType === "UNIT") {
    return { state, unitId: placeCard(state, "A", def, "battleArea"), pilotId: placeCard(state, "A", partner.pilot, "hand") };
  }
  return { state, unitId: placeCard(state, "A", partner.unit, "battleArea"), pilotId: placeCard(state, "A", def, "hand") };
}

function pairAction(state: GameState, pilotId: string, unitId: string, specs: EffectSpec[]): PlayerAction | undefined {
  return enumerateLegalActions(state, "A", specs, scenarioOpts).find(
    (a) => a.kind === "deployCard" && a.cardInstanceId === pilotId && "pairWithUnitId" in a && a.pairWithUnitId === unitId,
  );
}

function play(state: GameState, action: PlayerAction, specs: EffectSpec[]): GameState {
  return settleDecisions(applyPlayerAction(state, "A", action, specs, defaultPredicateResolver, defaultTargetFilterResolver), specs);
}

/* 【When Paired】 sem rastro neste tabuleiro, por motivo. A lista é cobrada. */
const SEM_RASTRO_NO_TABULEIRO: string[] = [
  // "N or more (X) cards in your trash" / "Development N" / "You may choose N (X) cards from your trash" — lixeira sem o trait
  "EB01-021", "EB01-047", "EB01-060", "GD02-061", "GD02-099", "GD03-020", "GD03-054", "GD05-017",
  // "Choose … (keyword/HP/nível/trait de outra Unit)" sem alvo que case no tabuleiro
  "EB01-045", "EB01-072", "GD01-032", "GD02-089", "GD05-036", "GD05-083", "ST14-012",
  // "If you have 2 or more other (X) Units" / "All friendly (Marine) Units" — nenhuma Unit do trait
  "ST05-012", "ST11-011",
  // "You may deploy 1 (Zeon) Unit … from your hand" — mão sem a carta
  "ST03-010",
];

describe(`【When Paired】 gerado — ${PAIRED_CARDS.length} cartas, caminho do jogador`, () => {
  it("o pareamento é oferecido pelas jogadas legais", () => {
    const naoOferecidas = PAIRED_CARDS.filter((code) => {
      const { state, pilotId, unitId } = readyToPair(code);
      return !pairAction(state, pilotId, unitId, ALL_EFFECT_SPECS);
    });
    expect(naoOferecidas).toEqual([]);
  }, 120_000);

  it("a favor: o 【When Paired】 muda o tabuleiro em relação ao mesmo pareamento sem ele", () => {
    const falhas: string[] = [];
    const semRastro: string[] = [];
    for (const code of PAIRED_CARDS) {
      const { state, pilotId, unitId } = readyToPair(code);
      const without = ALL_EFFECT_SPECS.filter((s) => !(s.cardCode === code && s.trigger === "When Paired"));
      const action = pairAction(state, pilotId, unitId, ALL_EFFECT_SPECS);
      const control = pairAction(state, pilotId, unitId, without);
      if (!action || !control) continue;
      try {
        const real = play(state, action, ALL_EFFECT_SPECS);
        const semEfeito = play(state, control, without);
        if (real.pendingDecision.A || real.pendingDecision.B) falhas.push(`${code}: decisão ficou pendente`);
        else if (fingerprint(real) === fingerprint(semEfeito)) semRastro.push(code);
      } catch (err) {
        falhas.push(`${code}: exceção ${(err as Error).message}`);
      }
    }
    expect(falhas).toEqual([]);
    expect([...semRastro].sort()).toEqual([...SEM_RASTRO_NO_TABULEIRO].sort());
  }, 180_000);
});
