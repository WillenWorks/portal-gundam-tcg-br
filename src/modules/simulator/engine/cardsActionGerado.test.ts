/* Camada 1 da fase de assertividade, categorias 【Action】 (Command) e 【Activate･Action】: gerado a partir de
 * ALL_EFFECT_SPECS e jogado pelo caminho do jogador — A ataca o jogador inimigo, os passes vão até A ter a vez no
 * Action Step, e ali a Command da mão (ou a habilidade da carta em campo) sai pela jogada legal. Controle: a MESMA
 * jogada com o efeito vazio — paga/descarta/descansa igual; só o efeito diferencia. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { actionOwner, enumerateLegalActions } from "./legalActions";
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

/** tabuleiro com recurso de sobra; `extra` põe a carta testada (na mão ou em campo) antes do ataque */
function board(specs: readonly EffectSpec[], extra: (state: GameState) => GameState): GameState {
  let state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 10; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  richBoard(state, "A", TRASH_MATERIAL);
  for (const spec of specs) {
    const target = friendlyTargetFor(spec);
    if (target) placeCard(state, "A", target, "battleArea", { damage: 1 });
  }
  state = extra(state);
  return state;
}

/** A ataca o jogador inimigo e passa até ter a vez no Action Step; `null` se o combate acabou antes */
function toActionStep(state: GameState, attackerId: string, specs: EffectSpec[]): GameState | null {
  const attack = enumerateLegalActions(state, "A", specs, scenarioOpts).find((a) => a.kind === "declareAttack" && a.attackerId === attackerId && a.target === "player");
  if (!attack) return null;
  let next = apply(state, "A", attack, specs);
  for (let guard = 0; guard < 10 && next.combat; guard++) {
    const seat = actionOwner(next);
    if (!seat) return null;
    if (seat === "A" && next.combat.step === "action") return next;
    const pass = enumerateLegalActions(next, seat, specs, scenarioOpts).find((a) => a.kind === "skipBlock" || a.kind === "passAction");
    if (!pass) return null;
    next = apply(next, seat, pass, specs);
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

function commandCase(code: string): Case | null {
  let cardId = "";
  const ready = board(ACTION_SPECS.filter((s) => s.cardCode === code), (s) => {
    cardId = placeCard(s, "A", ALL_CARD_DEFS[code], "hand");
    return s;
  });
  const attackerId = placeCard(ready, "A", ST01_CARD_DEFS.GUNDAM, "battleArea");
  const state = toActionStep(ready, attackerId, ALL_EFFECT_SPECS);
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

function activateCase(code: string): Case | null {
  const def = ALL_CARD_DEFS[code];
  const own = ACTIVATE_SPECS.filter((s) => s.cardCode === code);
  let sourceId = "";
  const ready = board(own, (s) => {
    if (def.cardType === "BASE") {
      s.players.A.baseSection = [];
      sourceId = placeCard(s, "A", def, "baseSection");
      return s;
    }
    const partner = partnerFor(own, def);
    const unitId = placeCard(s, "A", def.cardType === "UNIT" ? def : partner.unit, "battleArea");
    sourceId = def.cardType === "UNIT" ? unitId : "";
    if (def.cardType === "UNIT" && !needsPilot(own)) return s;
    const pilotId = placeCard(s, "A", def.cardType === "UNIT" ? partner.pilot : def, "hand");
    if (def.cardType !== "UNIT") sourceId = pilotId;
    const pair = enumerateLegalActions(s, "A", ALL_EFFECT_SPECS, scenarioOpts).find(
      (a) => a.kind === "deployCard" && a.cardInstanceId === pilotId && "pairWithUnitId" in a && a.pairWithUnitId === unitId,
    );
    return pair ? apply(s, "A", pair, ALL_EFFECT_SPECS) : s;
  });
  const attackerId = placeCard(ready, "A", ST01_CARD_DEFS.GUNDAM, "battleArea");
  const state = toActionStep(ready, attackerId, ALL_EFFECT_SPECS);
  if (!state) return null;
  return {
    state,
    play: (specs, st) =>
      preferTargeted(enumerateLegalActions(st, "A", specs, scenarioOpts).filter((a) => a.kind === "activateAbility" && a.sourceInstanceId === sourceId)),
  };
}

function run(codes: string[], trigger: "Action" | "Activate·Action", build: (code: string) => Case | null) {
  const naoOferecidas: string[] = [];
  const semRastro: string[] = [];
  const falhas: string[] = [];
  for (const code of codes) {
    const c = build(code);
    const action = c?.play(ALL_EFFECT_SPECS, c.state);
    if (!c || !action) {
      naoOferecidas.push(code);
      continue;
    }
    const control = ALL_EFFECT_SPECS.map((s) => (s.cardCode === code && s.trigger === trigger ? effectless(s) : s));
    try {
      const real = apply(c.state, "A", action, ALL_EFFECT_SPECS);
      if (real.pendingDecision.A || real.pendingDecision.B) {
        falhas.push(`${code}: decisão ficou pendente`);
        continue;
      }
      const semEfeito = apply(c.state, "A", action, control);
      if (fingerprint(real) === fingerprint(semEfeito)) semRastro.push(code);
    } catch (err) {
      falhas.push(`${code}: exceção ${(err as Error).message}`);
    }
  }
  return { naoOferecidas, semRastro, falhas };
}

/* Exceções deste tabuleiro, por motivo. As listas são cobradas. */
const COMMAND_NAO_OFERECIDAS: string[] = [
  // defesa: "battling a friendly Unit with <Blocker>/Lv.5 or higher" — aqui A é quem ataca
  "GD02-118", "GD05-119",
  // "Choose 1 rested friendly (G Generation)/(CB) Unit" para receber o ataque — nenhuma descansada do trait
  "EB01-077", "ST07-013",
  // "Choose 1 … (Link Unit, token, damaged enemy, Pilot inimigo, pareada com (Newtype)/(X-Rounder))" sem alvo
  "GD01-101", "GD01-111", "GD02-105", "GD03-102", "GD03-110", "GD03-115", "GD04-119",
];
const COMMAND_SEM_RASTRO: string[] = [
  // "If it is your opponent's turn / (Teiwaz)/(Gjallarhorn) Link Unit / 2 (UN) / (G Generation) Unit in play"
  "EB01-083", "GD02-113", "GD02-119", "GD04-118", "ST10-015",
  // efeito sem material: nenhuma Unit pareada; nenhum ataque inimigo para mudar de alvo
  "GD03-112", "GD05-108",
  // "recovers 2 HP" na 1ª Unit (Academy) escolhida, sem dano
  "GD05-109",
];
const ACTIVATE_NAO_OFERECIDAS: string[] = [
  // a carta não está na batalha: "Unit being attacked", "this Unit is battling", "battling this Unit"
  "EB01-033", "GD02-011", "GD03-073", "ST12-011",
  // custo "Exile N cards from your trash" sem as cartas
  "GD05-022", "ST12-006",
  // "Choose 1 friendly (ZAFT) Unit with 5 or more AP" sem alvo
  "GD01-127",
];
const ACTIVATE_SEM_RASTRO: string[] = [
  // "recovers 1 HP" na 1ª Unit escolhida, sem dano
  "EB01-020", "GD01-014",
  // "If it is your opponent's turn" / "enemy Unit with 1 or less AP"
  "EB01-070", "GD01-098",
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
