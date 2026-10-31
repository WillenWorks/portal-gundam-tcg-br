/* Camada 1 da fase de assertividade, categoria 【Destroyed】: para CADA carta com o gatilho, gerado a partir de
 * ALL_EFFECT_SPECS e jogado pelo caminho do jogador — a Unit da carta (ou a Unit pareada com o Piloto da carta)
 * ataca uma Unit inimiga muito mais forte e morre no Damage Step; passes e decisões pelas jogadas legais até o fim
 * do combate. Controle: o mesmo combate sem o 【Destroyed】 da carta. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { actionOwner, enumerateLegalActions } from "./legalActions";
import { placeCard } from "./__testkit__/cardHarness";
import { fingerprint, partnerFor, richBoard, scenarioOpts, settleDecisions, trashMaterialFor } from "./__testkit__/cardScenario";
import type { EffectSpec } from "./effectSpec";
import type { CardDef, GameState } from "./types";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const DESTROYED_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger === "Destroyed");
const DESTROYED_CARDS = [...new Set(DESTROYED_SPECS.map((s) => s.cardCode))]
  .sort()
  .filter((code) => ["UNIT", "PILOT"].includes(ALL_CARD_DEFS[code]?.cardType ?? ""));
const TRASH_MATERIAL = trashMaterialFor(DESTROYED_SPECS);
const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };
/** Unit inimiga que mata qualquer atacante e sobrevive — sem habilidade */
const WALL: CardDef = { ...ST01_CARD_DEFS.GM, code: "CA-WALL", nameEn: "Wall", level: 8, ap: 30, hp: 30, traits: [] };

const needsPilot = (specs: EffectSpec[]) =>
  specs.some((s) => s.duringPair || s.duringLink || /[pP]airedPilot|Link|selfIsPaired|wasPaired/.test(s.condition?.predicate ?? ""));

function apply(state: GameState, seat: "A" | "B", action: PlayerAction, specs: EffectSpec[]): GameState {
  return settleDecisions(applyPlayerAction(state, seat, action, specs, defaultPredicateResolver, defaultTargetFilterResolver), specs);
}

/** a Unit atacante (com o par, quando a carta é Piloto ou o gatilho pede Piloto) e a muralha inimiga descansada */
function readyToDie(code: string): { state: GameState; attackerId: string; wallId: string } | null {
  const def = ALL_CARD_DEFS[code];
  const own = DESTROYED_SPECS.filter((s) => s.cardCode === code);
  const partner = partnerFor(own, def);
  let state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 10; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  richBoard(state, "A", TRASH_MATERIAL);
  const wallId = placeCard(state, "B", WALL, "battleArea", { rested: true });
  const isUnit = def.cardType === "UNIT";
  const attackerId = placeCard(state, "A", isUnit ? def : partner.unit, "battleArea");
  if (!isUnit || needsPilot(own)) {
    const pilotId = placeCard(state, "A", isUnit ? partner.pilot : def, "hand");
    const pair = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, scenarioOpts).find(
      (a) => a.kind === "deployCard" && a.cardInstanceId === pilotId && "pairWithUnitId" in a && a.pairWithUnitId === attackerId,
    );
    if (!pair) return null;
    state = apply(state, "A", pair, ALL_EFFECT_SPECS);
  }
  return { state, attackerId, wallId };
}

/** ataca a muralha e joga passes/decisões até o combate acabar */
function fight(state: GameState, attackerId: string, wallId: string, specs: EffectSpec[]): GameState | null {
  const attack = enumerateLegalActions(state, "A", specs, scenarioOpts).find(
    (a) => a.kind === "declareAttack" && a.attackerId === attackerId && typeof a.target === "object" && a.target.unitId === wallId,
  );
  if (!attack) return null;
  let next = apply(state, "A", attack, specs);
  for (let guard = 0; guard < 40 && next.combat && !next.gameOver; guard++) {
    const seat = actionOwner(next);
    if (!seat) break;
    const legal = enumerateLegalActions(next, seat, specs, scenarioOpts);
    const pass = legal.find((a) => a.kind === "skipBlock" || a.kind === "passAction");
    if (!pass) break;
    next = apply(next, seat, pass, specs);
  }
  return next;
}

/* 【Destroyed】 sem rastro neste tabuleiro, por motivo. A lista é cobrada. */
const SEM_RASTRO_NO_TABULEIRO: string[] = [
  // "If you have another (X) Unit / an (Orb) Pilot / another Link Unit / a friendly white Base" — o tabuleiro não tem
  "GD01-007", "GD02-044", "GD04-011", "GD04-025", "GD04-080", "GD05-003", "ST04-009", "GD03-099",
  // "If it is your opponent's turn" — morreu atacando, no próprio turno
  "GD02-083", "ST07-010", "ST11-009",
  // "destroyed by one of your (Neo Zeon) card's effects" — morreu em batalha
  "GD05-053",
  // "Choose 1 of your (Neo Zeon) Units" — a única do trait era a que morreu
  "GD05-094",
  // W13a — "enemy Unit with <Blocker> and 3 or less AP" sem alvo; "another (G Team)/(Preventer)"; "Set 1 Resource as active" com todos ativos
  "GD06-024", "GD06-072", "GD06-053",
];

describe(`【Destroyed】 gerado — ${DESTROYED_CARDS.length} cartas, caminho do jogador`, () => {
  it("a Unit da carta ataca a muralha e é destruída em batalha", () => {
    const naoMorreu = DESTROYED_CARDS.filter((code) => {
      const ready = readyToDie(code);
      const after = ready && fight(ready.state, ready.attackerId, ready.wallId, ALL_EFFECT_SPECS);
      return !after || after.combat || after.players.A.battleArea.some((c) => c.instanceId === ready!.attackerId);
    });
    expect(naoMorreu).toEqual([]);
  }, 120_000);

  it("a favor: o 【Destroyed】 muda o tabuleiro em relação ao mesmo combate sem ele", () => {
    const falhas: string[] = [];
    const semRastro: string[] = [];
    for (const code of DESTROYED_CARDS) {
      const ready = readyToDie(code);
      if (!ready) continue;
      const without = ALL_EFFECT_SPECS.filter((s) => !(s.cardCode === code && s.trigger === "Destroyed"));
      try {
        const real = fight(ready.state, ready.attackerId, ready.wallId, ALL_EFFECT_SPECS);
        const control = fight(ready.state, ready.attackerId, ready.wallId, without);
        if (!real || !control) continue;
        if (real.pendingDecision.A || real.pendingDecision.B) falhas.push(`${code}: decisão ficou pendente`);
        else if (fingerprint(real) === fingerprint(control)) semRastro.push(code);
      } catch (err) {
        falhas.push(`${code}: exceção ${(err as Error).message}`);
      }
    }
    expect(falhas).toEqual([]);
    expect([...semRastro].sort()).toEqual([...SEM_RASTRO_NO_TABULEIRO].sort());
  }, 180_000);
});
