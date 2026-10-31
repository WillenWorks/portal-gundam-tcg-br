/* Camada 1 da fase de assertividade, categoria 【Main】 de Command: para CADA Command com o gatilho, gerado a partir
 * de ALL_EFFECT_SPECS e jogado pelo caminho do jogador — a carta na mão na Main Phase, jogada pela jogada legal
 * (com os alvos que o motor oferece), decisões pela jogada legal. Controle: a MESMA jogada com o efeito vazio — a
 * carta vai para a lixeira e o recurso é pago nos dois; só o efeito diferencia. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { placeCard } from "./__testkit__/cardHarness";
import { fingerprint, friendlyTargetFor, richBoard, scenarioOpts, settleDecisions, trashMaterialFor } from "./__testkit__/cardScenario";
import type { EffectSpec } from "./effectSpec";
import type { CardDef, GameState } from "./types";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const MAIN_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger === "Main");
const MAIN_CARDS = [...new Set(MAIN_SPECS.map((s) => s.cardCode))].sort().filter((code) => ALL_CARD_DEFS[code]?.cardType === "COMMAND");
const TRASH_MATERIAL = trashMaterialFor(MAIN_SPECS);
const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };

function withCommandInHand(code: string): { state: GameState; cardId: string } {
  const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 10; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  richBoard(state, "A", TRASH_MATERIAL);
  // alvo amigo do trait/nível que o texto pede, danificado ("recovers HP", "damaged friendly Unit")
  for (const spec of MAIN_SPECS.filter((s) => s.cardCode === code)) {
    const target = friendlyTargetFor(spec);
    if (target) placeCard(state, "A", target, "battleArea", { damage: 1 });
  }
  return { state, cardId: placeCard(state, "A", ALL_CARD_DEFS[code], "hand") };
}

/** a jogada do 【Main】 pelo custo normal, com alvo quando o motor oferece algum */
function playMain(state: GameState, cardId: string, specs: EffectSpec[]): PlayerAction | undefined {
  const plays = enumerateLegalActions(state, "A", specs, scenarioOpts).filter(
    (a) => a.kind === "playCommand" && a.cardInstanceId === cardId && a.trigger === "Main" && !a.altCostDiscardId,
  );
  return plays.find((a) => a.kind === "playCommand" && Object.values(a.targets ?? {}).some((ids) => ids.length > 0)) ?? plays[0];
}

function play(state: GameState, action: PlayerAction, specs: EffectSpec[]): GameState {
  return settleDecisions(applyPlayerAction(state, "A", action, specs, defaultPredicateResolver, defaultTargetFilterResolver), specs);
}

const effectless = (spec: EffectSpec): EffectSpec => ({ ...spec, actions: [], condition: undefined, condition2: undefined });

/* Não oferecidas neste tabuleiro (sem alvo legal / condição de jogar) — lista cobrada. */
const NAO_OFERECIDAS_NO_TABULEIRO: string[] = [
  // "Choose 1 friendly Link Unit / Unit paired with a (Newtype) Pilot / rested friendly Base / damaged enemy Unit /
  // Pilot paired with an enemy Unit" — o tabuleiro não tem o alvo
  "GD01-101", "ST08-012", "GD04-119", "GD03-119", "GD01-111", "GD03-110",
  // W13a — "(Ghingnham Fleet) Unit in play" (condição de jogar) / "damaged enemy Unit"
  "GD06-107", "GD06-113",
];
/* 【Main】 sem rastro além de pagar e descartar, neste tabuleiro — lista cobrada. */
const SEM_RASTRO_NO_TABULEIRO: string[] = [
  // "If …" que o tabuleiro não tem (6 Units descansadas, (AGE System), 6 roxas na lixeira, Link (Teiwaz), 2 (UN))
  "EB01-073", "GD02-103", "GD02-111", "GD02-113", "GD04-118",
  // efeito sem material: nenhuma Unit amiga danificada Lv.4-, nenhum token, nenhuma Unit pareada
  "GD01-102", "GD03-107", "GD03-112",
  // W13a — nenhuma (Neo Zeon) amiga Lv.4-
  "GD06-108",
  // "recovers 3 HP" na 1ª Unit escolhida, sem dano
  "ST01-013",
];

describe(`【Main】 de Command gerado — ${MAIN_CARDS.length} cartas, caminho do jogador`, () => {
  it("o 【Main】 é oferecido na Main Phase com recurso de sobra", () => {
    const naoOferecidas = MAIN_CARDS.filter((code) => {
      const { state, cardId } = withCommandInHand(code);
      return !playMain(state, cardId, ALL_EFFECT_SPECS);
    });
    expect(naoOferecidas.sort()).toEqual([...NAO_OFERECIDAS_NO_TABULEIRO].sort());
  }, 120_000);

  it("a favor: o efeito muda o tabuleiro em relação à mesma jogada com o efeito vazio", () => {
    const falhas: string[] = [];
    const semRastro: string[] = [];
    for (const code of MAIN_CARDS) {
      const { state, cardId } = withCommandInHand(code);
      const control = ALL_EFFECT_SPECS.map((s) => (s.cardCode === code && s.trigger === "Main" ? effectless(s) : s));
      const action = playMain(state, cardId, ALL_EFFECT_SPECS);
      if (!action) continue;
      // o controle joga com os mesmos alvos (o efeito vazio não os usa)
      try {
        const real = play(state, action, ALL_EFFECT_SPECS);
        if (real.pendingDecision.A || real.pendingDecision.B) {
          falhas.push(`${code}: decisão ficou pendente`);
          continue;
        }
        if (real.players.A.hand.some((c) => c.instanceId === cardId)) falhas.push(`${code}: a Command ficou na mão`);
        const semEfeito = applyPlayerAction(state, "A", action, control, defaultPredicateResolver, defaultTargetFilterResolver);
        if (fingerprint(real) === fingerprint(settleDecisions(semEfeito, control))) semRastro.push(code);
      } catch (err) {
        falhas.push(`${code}: exceção ${(err as Error).message}`);
      }
    }
    expect(falhas).toEqual([]);
    expect([...semRastro].sort()).toEqual([...SEM_RASTRO_NO_TABULEIRO].sort());
  }, 180_000);
});
