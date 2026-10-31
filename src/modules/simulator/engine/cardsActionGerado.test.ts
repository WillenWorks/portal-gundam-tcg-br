/* Camada 1 da fase de assertividade, categorias 【Action】 (Command) e 【Activate･Action】: gerado a partir de
 * ALL_EFFECT_SPECS e jogado pelo caminho do jogador — os passes vão até A ter a vez no Action Step, e ali a Command da
 * mão (ou a habilidade da carta em campo) sai pela jogada legal. Cenários, na ordem: A ataca o jogador inimigo; B
 * ataca o jogador A; B ataca uma Unit de A; B ataca e A bloqueia com <Blocker>. A carta conta como exercitada no 1º
 * cenário em que é oferecida. Controle: a MESMA jogada com o efeito vazio — só o efeito diferencia. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { actionOwner, enumerateLegalActions } from "./legalActions";
import { applyEvent } from "./events";
import { placeCard } from "./__testkit__/cardHarness";
import { fingerprint, friendlyTargetFor, partnerFor, richBoard, scenarioOpts, settleDecisions, trashMaterialFor } from "./__testkit__/cardScenario";
import type { EffectSpec } from "./effectSpec";
import type { CardDef, GameState } from "./types";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const ACTION_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger === "Action");
const ACTION_CARDS = [...new Set(ACTION_SPECS.map((s) => s.cardCode))].sort().filter((code) => ALL_CARD_DEFS[code]?.cardType === "COMMAND");
const ACTIVATE_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger === "Activate·Action");
const ACTIVATE_CARDS = [...new Set(ACTIVATE_SPECS.map((s) => s.cardCode))]
  .sort()
  .filter((code) => ["UNIT", "BASE", "PILOT"].includes(ALL_CARD_DEFS[code]?.cardType ?? ""));
const TRASH_MATERIAL = trashMaterialFor([...ACTION_SPECS, ...ACTIVATE_SPECS]);
const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };

const needsPilot = (specs: EffectSpec[]) =>
  specs.some((s) => s.duringPair || s.duringLink || /[pP]airedPilot|Link|selfIsPaired/.test(s.condition?.predicate ?? ""));

function apply(state: GameState, seat: "A" | "B", action: PlayerAction, specs: EffectSpec[]): GameState {
  return settleDecisions(applyPlayerAction(state, seat, action, specs, defaultPredicateResolver, defaultTargetFilterResolver), specs);
}

type Mode = "attack" | "defendPlayer" | "defendUnit" | "defendBlock";
const MODES: Mode[] = ["attack", "defendPlayer", "defendUnit", "defendBlock"];
/** atacante de B nos cenários de defesa: Lv.4, 4 HP (alvo de "enemy Unit with 4 or less HP battling …") */
const RAIDER: CardDef = { ...ST01_CARD_DEFS.GM, code: "CA-RAIDER", nameEn: "Raider", level: 4, ap: 3, hp: 4, traits: [] };

/** tabuleiro com recurso de sobra; `extra` põe a carta testada (na mão ou em campo) antes do ataque.
 *  Na defesa, a vez é de B e os alvos amigos gerados ficam descansados (podem ser atacados / receber o ataque). */
function board(specs: readonly EffectSpec[], mode: Mode, extra: (state: GameState) => GameState): GameState {
  let state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: mode === "attack" ? "A" : "B" }));
  for (let i = 0; i < 10; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  richBoard(state, "A", TRASH_MATERIAL);
  for (const spec of specs) {
    const target = friendlyTargetFor(spec);
    if (target) placeCard(state, "A", target, "battleArea", { damage: 1, rested: mode !== "attack" });
  }
  state = extra(state);
  return state;
}

/**
 * Leva o combate até A ter a vez no Action Step. `attack`: A ataca o jogador com uma Unit sua. Defesa: um atacante de B
 * ataca o jogador A (ou `attackedUnitId`); em `defendBlock`, A bloqueia com um <Blocker> ativo. `null` se não deu.
 */
function toActionStep(state: GameState, specs: EffectSpec[], mode: Mode, attackedUnitId?: string): GameState | null {
  const atk = mode === "attack" ? "A" : "B";
  if (mode === "defendUnit" && !attackedUnitId) return null;
  const attackerId = placeCard(state, atk, mode === "attack" ? ST01_CARD_DEFS.GUNDAM : RAIDER, "battleArea");
  const blockerId = mode === "defendBlock" ? placeCard(state, "A", ST01_CARD_DEFS.ZOWORT, "battleArea") : undefined;
  const attack = enumerateLegalActions(state, atk, specs, scenarioOpts).find(
    (a) =>
      a.kind === "declareAttack" &&
      a.attackerId === attackerId &&
      (mode === "defendUnit" ? typeof a.target === "object" && a.target.unitId === attackedUnitId : a.target === "player"),
  );
  if (!attack) return null;
  let next = apply(state, atk, attack, specs);
  for (let guard = 0; guard < 10 && next.combat; guard++) {
    const seat = actionOwner(next);
    if (!seat) return null;
    if (seat === "A" && next.combat.step === "action") return next;
    const options = enumerateLegalActions(next, seat, specs, scenarioOpts);
    const block = blockerId ? options.find((a) => a.kind === "activateBlocker" && a.blockerId === blockerId) : undefined;
    const step = block ?? options.find((a) => a.kind === "skipBlock" || a.kind === "passAction");
    if (!step) return null;
    next = apply(next, seat, step, specs);
  }
  return null;
}

const effectless = (spec: EffectSpec): EffectSpec => ({ ...spec, actions: [], condition: undefined, condition2: undefined });

/** jogada preferida: a que escolhe algum alvo, se houver */
const preferTargeted = (plays: PlayerAction[]) =>
  plays.find((a) => "targets" in a && Object.values(a.targets ?? {}).some((ids) => ids.length > 0)) ?? plays[0];

interface Case {
  state: GameState;
  play: (specs: EffectSpec[], state: GameState) => PlayerAction | undefined;
}

function commandCase(code: string, mode: Mode): Case | null {
  let cardId = "";
  const ready = board(ACTION_SPECS.filter((s) => s.cardCode === code), mode, (s) => {
    cardId = placeCard(s, "A", ALL_CARD_DEFS[code], "hand");
    return s;
  });
  // defesa de Unit: a 1ª Unit descansada de A (o alvo amigo gerado, ou a do tabuleiro)
  const attacked = ready.players.A.battleArea.find((u) => u.rested)?.instanceId;
  const state = toActionStep(ready, ALL_EFFECT_SPECS, mode, attacked);
  if (!state) return null;
  return {
    state,
    play: (specs, st) =>
      preferTargeted(
        enumerateLegalActions(st, "A", specs, scenarioOpts).filter(
          (a) => a.kind === "playCommand" && a.cardInstanceId === cardId && a.trigger === "Action" && !a.altCostDiscardId,
        ),
      ),
  };
}

function activateCase(code: string, mode: Mode): Case | null {
  const def = ALL_CARD_DEFS[code];
  const own = ACTIVATE_SPECS.filter((s) => s.cardCode === code);
  let sourceId = "";
  let unitInPlay: string | undefined;
  const ready = board(own, mode, (s) => {
    if (def.cardType === "BASE") {
      s.players.A.baseSection = [];
      sourceId = placeCard(s, "A", def, "baseSection");
      return s;
    }
    const partner = partnerFor(own, def);
    const unitId = placeCard(s, "A", def.cardType === "UNIT" ? def : partner.unit, "battleArea", { rested: mode === "defendUnit" });
    unitInPlay = unitId;
    sourceId = def.cardType === "UNIT" ? unitId : "";
    if (def.cardType === "UNIT" && !needsPilot(own)) return s;
    const pilotDef = def.cardType === "UNIT" ? partner.pilot : def;
    if (mode !== "attack") {
      // na defesa a vez é de B e A não joga Piloto: o par já está em campo (preparo; a jogada testada é a ativação)
      const pilotId = placeCard(s, "A", pilotDef, "battleArea");
      if (def.cardType !== "UNIT") sourceId = pilotId;
      return applyEvent(s, { type: "PAIR_CARDS", pilotId, unitId });
    }
    const pilotId = placeCard(s, "A", pilotDef, "hand");
    if (def.cardType !== "UNIT") sourceId = pilotId;
    const pair = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, scenarioOpts).find(
      (a) => a.kind === "deployCard" && a.cardInstanceId === pilotId && "pairWithUnitId" in a && a.pairWithUnitId === unitId,
    );
    return pair ? apply(s, "A", pair, ALL_EFFECT_SPECS) : s;
  });
  // defesa de Unit: a Unit da carta (ou a pareada com o Piloto da carta) é a atacada
  const state = toActionStep(ready, ALL_EFFECT_SPECS, mode, unitInPlay);
  if (!state) return null;
  return {
    state,
    play: (specs, st) =>
      preferTargeted(enumerateLegalActions(st, "A", specs, scenarioOpts).filter((a) => a.kind === "activateAbility" && a.sourceInstanceId === sourceId)),
  };
}

/**
 * Para cada carta: em todo cenário em que a jogada é oferecida, joga com o efeito e com o efeito vazio. Basta um
 * cenário com rastro ("change the attack target" só faz algo na defesa). Exceção ou decisão pendente é falha.
 */
function run(codes: string[], trigger: "Action" | "Activate·Action", build: (code: string, mode: Mode) => Case | null) {
  const naoOferecidas: string[] = [];
  const semRastro: string[] = [];
  const falhas: string[] = [];
  for (const code of codes) {
    const control = ALL_EFFECT_SPECS.map((s) => (s.cardCode === code && s.trigger === trigger ? effectless(s) : s));
    let offered = false;
    let traced = false;
    for (const mode of MODES) {
      const c = build(code, mode);
      const action = c?.play(ALL_EFFECT_SPECS, c.state);
      if (!c || !action) continue;
      offered = true;
      try {
        const real = apply(c.state, "A", action, ALL_EFFECT_SPECS);
        if (real.pendingDecision.A || real.pendingDecision.B) {
          falhas.push(`${code} (${mode}): decisão ficou pendente`);
          continue;
        }
        const ctl = apply(c.state, "A", action, control);
        if (fingerprint(real) !== fingerprint(ctl)) {
          traced = true;
          break;
        }
      } catch (err) {
        falhas.push(`${code} (${mode}): exceção ${(err as Error).message}`);
      }
    }
    if (!offered) naoOferecidas.push(code);
    else if (!traced) semRastro.push(code);
  }
  return { naoOferecidas, semRastro, falhas };
}

/* Exceções deste tabuleiro, por motivo. As listas são cobradas. */
const COMMAND_NAO_OFERECIDAS: string[] = [
  // "battling one of your Units that is Lv.5 or higher" — as Units de A atacadas/bloqueando são de nível baixo
  "GD05-119",
  // "Choose 1 … (Link Unit, token, damaged enemy, Pilot inimigo, pareada com (Newtype)/(X-Rounder))" sem alvo
  "GD01-101", "GD01-111", "GD02-105", "GD03-102", "GD03-110", "GD03-115", "GD04-119",
  // W13a — "enemy Unit battling a friendly (AEUG) Unit" / "damaged enemy Unit" sem alvo
  "GD06-112", "GD06-113",
];
const COMMAND_SEM_RASTRO: string[] = [
  // "If a (Teiwaz)/(Gjallarhorn) Link Unit / 2 (UN) / (G Generation) Unit is in play"
  "GD02-113", "GD02-119", "GD04-118", "ST10-015",
  // W13a — "If there are 4 or more (Gjallarhorn) cards in your trash"
  "GD06-111",
  // efeito sem material: nenhuma Unit pareada
  "GD03-112",
  // "recovers 2 HP" na 1ª Unit (Academy) escolhida, sem dano
  "GD05-109",
];
const ACTIVATE_NAO_OFERECIDAS: string[] = [
  // "this Unit is battling an enemy Base/Shield" (só atacando com ela) / "damaged enemy Unit battling this Unit"
  "GD02-011", "ST12-011",
  // "Choose 1 friendly (ZAFT) Unit with 5 or more AP" sem alvo
  "GD01-127",
];
const ACTIVATE_SEM_RASTRO: string[] = [
  // "recovers 1 HP" na 1ª Unit escolhida, sem dano
  "EB01-020", "GD01-014",
  // "If there are 6 or more (Gjallarhorn) cards in your trash" / "If an enemy Unit with 1 or less AP is in play"
  "GD03-073", "GD01-098",
];

describe(`【Action】 gerado — ${ACTION_CARDS.length} Commands e ${ACTIVATE_CARDS.length} cartas com 【Activate･Action】, no Action Step`, () => {
  it("Command 【Action】: oferecida no Action Step e o efeito muda o tabuleiro", () => {
    const r = run(ACTION_CARDS, "Action", commandCase);
    expect(r.falhas).toEqual([]);
    expect(r.naoOferecidas.sort()).toEqual([...COMMAND_NAO_OFERECIDAS].sort());
    expect(r.semRastro.sort()).toEqual([...COMMAND_SEM_RASTRO].sort());
  }, 180_000);

  it("【Activate･Action】: oferecido no Action Step e o efeito muda o tabuleiro", () => {
    const r = run(ACTIVATE_CARDS, "Activate·Action", activateCase);
    expect(r.falhas).toEqual([]);
    expect(r.naoOferecidas.sort()).toEqual([...ACTIVATE_NAO_OFERECIDAS].sort());
    expect(r.semRastro.sort()).toEqual([...ACTIVATE_SEM_RASTRO].sort());
  }, 180_000);
});
