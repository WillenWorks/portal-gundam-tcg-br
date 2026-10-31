/* Camada 1 da fase de assertividade, categoria 【Deploy】: para CADA Unit/Base com spec de 【Deploy】, gerado a partir
 * de ALL_EFFECT_SPECS e jogado pelo caminho do jogador — a carta na mão, o deploy oferecido pelas jogadas legais,
 * as decisões resolvidas pela jogada legal. O controle é a mesma jogada com o 【Deploy】 da carta removido dos
 * specs: se o tabuleiro sai igual, o efeito não fez nada. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { enumerateLegalActions } from "./legalActions";
import { placeCard } from "./__testkit__/cardHarness";
import { fingerprint, richBoard, scenarioOpts, settleDecisions, trashMaterialFor } from "./__testkit__/cardScenario";
import type { EffectSpec } from "./effectSpec";
import type { CardDef, GameState } from "./types";
import { buildSt01DeckList } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const DEPLOY_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger === "Deploy");
const DEPLOY_CARDS = [...new Set(DEPLOY_SPECS.map((s) => s.cardCode))].sort().filter((code) => ALL_CARD_DEFS[code]);
const TRASH_MATERIAL = trashMaterialFor(DEPLOY_SPECS);
const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };

/** A na Main Phase com recurso de sobra, `def` na mão e o tabuleiro de `richBoard` */
function withCardInHand(def: CardDef): { state: GameState; cardId: string } {
  const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 10; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  richBoard(state, "A", TRASH_MATERIAL);
  const cardId = placeCard(state, "A", def, "hand");
  return { state, cardId };
}

/** deploy "puro" da carta (sem parear, sem sacrifício), como o motor oferece com estes specs */
function deployAction(state: GameState, cardId: string, specs: EffectSpec[]): PlayerAction | undefined {
  return enumerateLegalActions(state, "A", specs, scenarioOpts).find(
    (a) => a.kind === "deployCard" && a.cardInstanceId === cardId && !("pairWithUnitId" in a && a.pairWithUnitId) && !("sacrificeId" in a && a.sacrificeId),
  );
}

function play(state: GameState, action: PlayerAction, specs: EffectSpec[]): GameState {
  return settleDecisions(applyPlayerAction(state, "A", action, specs, defaultPredicateResolver, defaultTargetFilterResolver), specs);
}

/* 【Deploy】 que, neste tabuleiro, não deixam rastro visível (condição não atendida, efeito que só vale num evento
 * futuro, …). A lista é cobrada: entrar ou sair dela é decisão consciente. */
const SEM_RASTRO_NO_TABULEIRO: string[] = [
  // "If another friendly (X) Unit / X cards in your trash / you are Lv.7 / friendly white Base" — trait ou contagem que o tabuleiro não tem
  "EB01-002", "GD01-027", "GD02-026", "GD02-043", "GD02-060", "GD02-070", "GD02-071", "GD02-081", "GD03-072", "GD05-020", "ST06-002", "ST11-001",
  // "Development N" / "You may choose N (X) cards from your trash. Exile them" — lixeira sem as cartas do trait
  "EB01-008", "EB01-010", "EB01-025", "EB01-027", "ST10-002", "ST10-008", "GD03-009", "GD05-066",
  // "If 4/5 or more enemy Units" / "2 or more enemy players" — o tabuleiro tem 3 Units inimigas, 1 oponente
  "EB01-029", "EB01-040", "EB01-044", "GD01-038", "ST13-005",
  // "If you deploy this Unit from your trash" — veio da mão
  "GD03-062", "GD04-060", "GD05-064", "ST09-006",
  // "Choose 1 … (trait/nível/AP/HP/token/Piloto pareado)" sem alvo que case no tabuleiro
  "EB01-057", "GD01-049", "GD01-068", "GD01-075", "GD02-040", "GD02-041", "GD02-046", "GD03-039", "GD04-023", "GD04-036", "GD04-063", "GD05-011", "ST06-007",
  // "For each … in your trash, AP-1" — zero cartas contadas, modificador de 0
  "GD03-071", "GD04-057",
  // "You may deploy/pair 1 (X) … from your hand" — mão sem a carta
  "GD01-028", "GD04-070",
  // "Look at the top card … top or bottom/trash" — a 1ª opção ("topo") deixa o deck como estava
  "GD01-039", "GD02-025", "GD04-026", "GD05-029", "ST13-004",
  // "Choose 1 enemy player. That player chooses 2 Unit cards from their trash" — lixeira do oponente sem Units
  "ST14-003",
  // W13a — "3 Unit cards from your trash" / "4+ (Gjallarhorn) in your trash" / "another (Alphacide)" / "enemy Unit with 1 HP"
  "GD06-002", "GD06-034", "GD06-006", "GD06-009",
  // W13b — "Choose 1 of your Unit tokens" sem token; "another (Alphacide)" (o efeito ganho é de fim de turno)
  "GD06-021", "GD06-051",
];

describe(`【Deploy】 gerado — ${DEPLOY_CARDS.length} cartas, caminho do jogador`, () => {
  it("toda Unit/Base com 【Deploy】 pode ser jogada da mão com recurso de sobra", () => {
    const naoOferecidas = DEPLOY_CARDS.filter((code) => {
      const { state, cardId } = withCardInHand(ALL_CARD_DEFS[code]);
      return !deployAction(state, cardId, ALL_EFFECT_SPECS);
    });
    expect(naoOferecidas).toEqual([]);
  }, 120_000);

  it("a favor: o 【Deploy】 muda o tabuleiro em relação à mesma jogada sem ele", () => {
    const falhas: string[] = [];
    const semRastro: string[] = [];
    for (const code of DEPLOY_CARDS) {
      const { state, cardId } = withCardInHand(ALL_CARD_DEFS[code]);
      const withoutDeploy = ALL_EFFECT_SPECS.filter((s) => !(s.cardCode === code && s.trigger === "Deploy"));
      const action = deployAction(state, cardId, ALL_EFFECT_SPECS);
      const control = deployAction(state, cardId, withoutDeploy);
      if (!action || !control) continue; // o teste de oferta acusa
      try {
        const real = play(state, action, ALL_EFFECT_SPECS);
        const semEfeito = play(state, control, withoutDeploy);
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

describe("achados da camada 1 de 【Deploy】", () => {
  it.each(["EB01-089", "GD01-125"])("%s: sem nada para o \"Then, choose/deploy …\", o \"Add 1 of your Shields to your hand\" ainda acontece", (code) => {
    const { state, cardId } = withCardInHand(ALL_CARD_DEFS[code]);
    const shields = state.players.A.shields.length;
    const hand = state.players.A.hand.length;
    const next = play(state, deployAction(state, cardId, ALL_EFFECT_SPECS)!, ALL_EFFECT_SPECS);
    expect(next.players.A.shields).toHaveLength(shields - 1);
    expect(next.players.A.hand).toHaveLength(hand); // a Base saiu da mão, a shield entrou
  });
});
