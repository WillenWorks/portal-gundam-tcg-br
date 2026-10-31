/* Camada 1 da fase de assertividade, categoria 【Activate･Main】: para CADA carta com o gatilho, gerado a partir de
 * ALL_EFFECT_SPECS e jogado pelo caminho do jogador — a carta em campo (Unit, ou Base no lugar da EX Base), a
 * ativação oferecida pelas jogadas legais, as decisões pela jogada legal. Controle: a MESMA ativação com o custo
 * mantido e o efeito vazio — o que difere no tabuleiro é só o efeito. */
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

const ACTIVATE_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger === "Activate·Main");
const ACTIVATE_CARDS = [...new Set(ACTIVATE_SPECS.map((s) => s.cardCode))]
  .sort()
  .filter((code) => ["UNIT", "BASE"].includes(ALL_CARD_DEFS[code]?.cardType ?? ""));
const TRASH_MATERIAL = trashMaterialFor(ACTIVATE_SPECS);
const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };

const needsPilot = (specs: EffectSpec[]) =>
  specs.some((s) => s.duringPair || s.duringLink || /pairedPilot|Link|selfIsPaired/.test(s.condition?.predicate ?? ""));

function play(state: GameState, action: PlayerAction, specs: EffectSpec[]): GameState {
  return settleDecisions(applyPlayerAction(state, "A", action, specs, defaultPredicateResolver, defaultTargetFilterResolver), specs);
}

/** a carta em campo, com o par quando o gatilho pede Piloto */
function inPlay(code: string): { state: GameState; sourceId: string } | null {
  const def = ALL_CARD_DEFS[code];
  const own = ACTIVATE_SPECS.filter((s) => s.cardCode === code);
  let state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 10; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  richBoard(state, "A", TRASH_MATERIAL);
  if (def.cardType === "BASE") state.players.A.baseSection = [];
  const sourceId = placeCard(state, "A", def, def.cardType === "BASE" ? "baseSection" : "battleArea");
  if (def.cardType === "UNIT" && needsPilot(own)) {
    const pilotId = placeCard(state, "A", partnerFor(own, def).pilot, "hand");
    const pair = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, scenarioOpts).find(
      (a) => a.kind === "deployCard" && a.cardInstanceId === pilotId && "pairWithUnitId" in a && a.pairWithUnitId === sourceId,
    );
    if (!pair) return null;
    state = play(state, pair, ALL_EFFECT_SPECS);
  }
  return { state, sourceId };
}

function activation(state: GameState, sourceId: string, specs: EffectSpec[]): PlayerAction | undefined {
  return enumerateLegalActions(state, "A", specs, scenarioOpts).find((a) => a.kind === "activateAbility" && a.sourceInstanceId === sourceId);
}

/** o mesmo spec com o custo e sem o efeito */
const effectless = (spec: EffectSpec): EffectSpec => ({ ...spec, actions: [], condition: undefined, condition2: undefined });

/* Não oferecidas neste tabuleiro: o custo ou o alvo não existe (o motor não oferece ativação que não dá para pagar
 * nem "Choose" sem alvo legal). A lista é cobrada. */
const NAO_OFERECIDAS_NO_TABULEIRO: string[] = [
  // custo "Exile N (X) cards from your trash" — lixeira sem as cartas (as outras recebem o material: `trashMaterialFor`)
  "EB01-001",
  // custo "Rest N of your (X) Units" / "Destroy 1 friendly Unit token" — sem as Units/token
  "GD04-006", "GD04-125", "GD05-038", "ST13-010",
  // "Choose 1 (Londo Bell)/damaged/token Unit" sem alvo legal
  "GD05-125", "ST05-015", "ST13-001",
  // W13a — "Choose 1 friendly (Zeon) Unit" sem alvo
  "GD06-128",
];

/* 【Activate･Main】 sem rastro além do custo, neste tabuleiro, por motivo. A lista é cobrada. */
const SEM_RASTRO_NO_TABULEIRO: string[] = [
  // "If …" que o tabuleiro não tem (trait, Link Unit, nome, destruída por efeito, combate no turno)
  "GD05-079", "GD05-126", "GD05-128", "GD05-129", "ST06-014", "ST12-016",
  // W13a — "another (Dianna Counter) Unit" / "3 or more (Ghingnham Fleet)/(Long-Range Weapon) Units"
  "GD06-078", "GD06-124",
  // efeito sem material: Link Units
  "ST01-016",
  // escolha que não muda nada: "recovers HP" na 1ª Unit (sem dano); "Set this Unit as active" já ativa
  "GD01-124", "ST08-015", "ST02-006",
];

describe(`【Activate･Main】 gerado — ${ACTIVATE_CARDS.length} cartas em campo, caminho do jogador`, () => {
  it("a ativação é oferecida na Main Phase com recurso de sobra", () => {
    const naoOferecidas = ACTIVATE_CARDS.filter((code) => {
      const ready = inPlay(code);
      return !ready || !activation(ready.state, ready.sourceId, ALL_EFFECT_SPECS);
    });
    expect(naoOferecidas.sort()).toEqual([...NAO_OFERECIDAS_NO_TABULEIRO].sort());
  }, 120_000);

  it("a favor: o efeito muda o tabuleiro em relação à mesma ativação só com o custo", () => {
    const falhas: string[] = [];
    const semRastro: string[] = [];
    for (const code of ACTIVATE_CARDS) {
      const ready = inPlay(code);
      if (!ready) continue;
      const control = ALL_EFFECT_SPECS.map((s) => (s.cardCode === code && s.trigger === "Activate·Main" ? effectless(s) : s));
      const action = activation(ready.state, ready.sourceId, ALL_EFFECT_SPECS);
      const controlAction = activation(ready.state, ready.sourceId, control);
      if (!action) continue;
      try {
        const real = play(ready.state, action, ALL_EFFECT_SPECS);
        if (real.pendingDecision.A || real.pendingDecision.B) falhas.push(`${code}: decisão ficou pendente`);
        else if (controlAction && fingerprint(real) === fingerprint(play(ready.state, controlAction, control))) semRastro.push(code);
      } catch (err) {
        falhas.push(`${code}: exceção ${(err as Error).message}`);
      }
    }
    expect(falhas).toEqual([]);
    expect([...semRastro].sort()).toEqual([...SEM_RASTRO_NO_TABULEIRO].sort());
  }, 180_000);
});
