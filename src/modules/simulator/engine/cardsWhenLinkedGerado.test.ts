/* Camada 1 da fase de assertividade, categoria 【When Linked】: para CADA carta com o gatilho, gerado a partir de
 * ALL_EFFECT_SPECS e jogado pelo caminho do jogador — o pareamento oferecido pelas jogadas legais (Unit da carta
 * + Piloto sem efeito, ou Piloto da carta + Unit sem efeito), as decisões pela jogada legal. Controle: a mesma
 * jogada sem o 【When Linked】 da carta. O par cumpre o Link (`partnerFor` com a carta). */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { placeCard } from "./__testkit__/cardHarness";
import { fingerprint, partnerFor, richBoard, scenarioOpts, settleDecisions, trashMaterialFor } from "./__testkit__/cardScenario";
import type { EffectSpec } from "./effectSpec";
import type { CardDef, GameState } from "./types";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const LINKED_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger === "When Linked");
const LINKED_CARDS = [...new Set(LINKED_SPECS.map((s) => s.cardCode))].sort().filter((code) => ALL_CARD_DEFS[code]);
const TRASH_MATERIAL = trashMaterialFor(LINKED_SPECS);
const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };
/** a carta e o par dela prontos: Unit em campo + Piloto na mão, ou Piloto na mão + Unit em campo */
function readyToPair(code: string): { state: GameState; pilotId: string; unitId: string } {
  const def = ALL_CARD_DEFS[code];
  const partner = partnerFor(LINKED_SPECS.filter((sp) => sp.cardCode === code), def);
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

/* 【When Linked】 sem rastro neste tabuleiro, por motivo. A lista é cobrada. */
const SEM_RASTRO_NO_TABULEIRO: string[] = [
  // "If you have another (X) Unit" / "5 or more purple cards" / "Development 2" — o tabuleiro não tem
  "GD03-024", "ST06-001", "ST09-003", "ST10-007",
  // "Choose 1 … (enemy <Blocker>, damaged enemy, other (X) Unit)" sem alvo que case
  "GD02-087", "GD04-009", "GD04-092", "GD04-095",
];

describe(`【When Linked】 gerado — ${LINKED_CARDS.length} cartas, caminho do jogador`, () => {
  it("o pareamento que cumpre o Link é oferecido pelas jogadas legais", () => {
    const naoOferecidas = LINKED_CARDS.filter((code) => {
      const { state, pilotId, unitId } = readyToPair(code);
      return !pairAction(state, pilotId, unitId, ALL_EFFECT_SPECS);
    });
    expect(naoOferecidas).toEqual([]);
  }, 120_000);

  it("a favor: o 【When Linked】 muda o tabuleiro em relação ao mesmo pareamento sem ele (e o Link de fato acontece)", () => {
    const falhas: string[] = [];
    const semRastro: string[] = [];
    for (const code of LINKED_CARDS) {
      const { state, pilotId, unitId } = readyToPair(code);
      const without = ALL_EFFECT_SPECS.filter((s) => !(s.cardCode === code && s.trigger === "When Linked"));
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
