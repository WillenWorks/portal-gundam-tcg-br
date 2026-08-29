import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList, VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import { ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ST02_CARD_DEFS } from "../fixtures/st02Deck";
import type { CardDef, CardInstance, GameState, PlayerId } from "./types";
import {
  activateBlocker,
  canActivateBlocker,
  declareAttack,
  passAction,
  proceedToBlockStep,
  resolveBattleEndStep,
  resolveDamageStep,
  skipBlock,
} from "./combat";
import { activateSupport } from "./keywords";
import { findCard } from "./events";

let seq = 0;
/**
 * Coloca uma carta direto na Battle Area de um jogador, sem passar pelo
 * fluxo de "jogar da mão" (ainda não implementado — jogar carta é passo
 * futuro do plano incremental). Muta `state` diretamente por conveniência
 * de fixture de teste; o motor em si nunca faz isso (ver events.ts).
 */
function place(state: GameState, player: PlayerId, def: CardDef, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-fixture-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone: "battleArea",
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    // -1: por padrão, `place()` monta uma Unit já estabelecida em campo desde
    // um turno anterior (não "recém-deployada"), pra não trombar com a regra
    // 3-2-4 (ver combat.ts/declareAttack) à toa nos testes que só querem
    // exercitar a sequência de combate em si. Testes que querem exatamente o
    // caso "recém-deployada" passam `{ enteredZoneOnTurn: state.turnNumber }`.
    enteredZoneOnTurn: state.turnNumber - 1,
    ...opts,
  };
  state.players[player].battleArea.push(card);
  return instanceId;
}

function stripBase(state: GameState, player: PlayerId): GameState {
  return { ...state, players: { ...state.players, [player]: { ...state.players[player], baseSection: [] } } };
}

function freshGame(): GameState {
  // ataques só podem ser declarados na Main Phase — o setup puro pára na Start Phase,
  // então os testes de combate pulam direto pra Main sem rodar Draw/Resource (que
  // mudariam mão/resourceDeck e complicariam as asserções de zona sem relação com combate).
  const state = createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 9, firstPlayer: "A" });
  return { ...state, phase: "main" };
}

/** Ataca de A contra B, passando Block Step sem bloquear e Action Step sem ninguém agir — chega direto no Damage Step. */
function runToDamageStep(state: GameState, attackerId: string, target: Parameters<typeof declareAttack>[2]): GameState {
  let next = declareAttack(state, attackerId, target);
  next = proceedToBlockStep(next);
  next = skipBlock(next);
  next = passAction(next, next.combat!.defendingPlayer);
  next = passAction(next, next.combat!.attackingPlayer);
  expect(next.combat!.step).toBe("damage");
  return next;
}

describe("sequência de combate (Comprehensive Rules seção 8 / docs/18)", () => {
  it("unit forte destrói unit fraca rested sem morrer (dano simultâneo, sem keyword)", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.HEAVY_01);
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, { rested: true });

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    const attacker = findCard(state, attackerId);
    expect(attacker.zone).toBe("battleArea");
    expect(attacker.damage).toBe(1); // VANILLA_01 tem AP1
    expect(state.players.B.trash.some((c) => c.instanceId === defenderId)).toBe(true);
  });

  it("<Blocker> redireciona o ataque e resta a Unit bloqueadora", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02);
    const blockerId = place(state, "B", VANILLA_CARD_DEFS.BLOCKER_01);

    state = declareAttack(state, attackerId, "player");
    state = proceedToBlockStep(state);
    expect(canActivateBlocker(state)).toBe(true);
    state = activateBlocker(state, blockerId);

    expect(state.combat!.currentTarget).toEqual({ unitId: blockerId });
    expect(findCard(state, blockerId).rested).toBe(true);
    expect(state.combat!.step).toBe("action");
  });

  it("<High-Maneuver> impede a ativação de <Blocker>", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.HIGH_MANEUVER_01);
    const blockerId = place(state, "B", VANILLA_CARD_DEFS.BLOCKER_01);

    state = declareAttack(state, attackerId, "player");
    state = proceedToBlockStep(state);
    expect(canActivateBlocker(state)).toBe(false);
    expect(() => activateBlocker(state, blockerId)).toThrow();
  });

  it("<First Strike>: se destrói o alvo, não recebe dano de volta (Comprehensive Rules 13-1-5-2)", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.FIRST_STRIKE_01); // AP2/HP2
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, { rested: true }); // AP1/HP1

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(findCard(state, attackerId).damage).toBe(0);
    expect(state.players.B.trash.some((c) => c.instanceId === defenderId)).toBe(true);
  });

  it("<First Strike> só evita dano de volta se de fato destruir o alvo", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.FIRST_STRIKE_01); // AP2/HP2
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.BLOCKER_01, { rested: true }); // AP1/HP3, não morre com 2 dano

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(findCard(state, defenderId).damage).toBe(2);
    expect(findCard(state, attackerId).damage).toBe(1); // sobreviveu e recebeu o contra-ataque normalmente
  });

  it("ataque direto ao jogador sem Base remove 1 shield", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02);
    const before = state.players.B.shields.length;

    state = runToDamageStep(state, attackerId, "player");
    state = resolveDamageStep(state);

    expect(state.players.B.shields).toHaveLength(before - 1);
  });

  it("Base absorve o dano em vez dos shields, sem sobra pro shield (EX Base, 3 HP)", () => {
    let state = freshGame(); // EX Base do setup continua em B
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02); // AP2 — não destrói a Base de 3 HP
    const shieldsBefore = state.players.B.shields.length;
    const baseId = state.players.B.baseSection[0].instanceId;

    state = runToDamageStep(state, attackerId, "player");
    state = resolveDamageStep(state);

    expect(findCard(state, baseId).damage).toBe(2);
    expect(state.players.B.shields).toHaveLength(shieldsBefore);
  });

  it("<Suppression> danifica os 2 primeiros shields simultaneamente", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.SUPPRESSION_01);
    const before = state.players.B.shields.length;

    state = runToDamageStep(state, attackerId, "player");
    state = resolveDamageStep(state);

    expect(state.players.B.shields).toHaveLength(before - 2);
  });

  it("<Breach N>: ao destruir Unit inimiga em batalha, causa N dano extra no shield", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.BREACH_01); // AP3/HP3, Breach 1
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, { rested: true }); // AP1/HP1
    const before = state.players.B.shields.length;

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(state.players.B.trash.some((c) => c.instanceId === defenderId)).toBe(true);
    expect(state.players.B.shields).toHaveLength(before - 1);
  });

  it("jogador sem shield e sem Base perde ao receber dano de batalha (Comprehensive Rules 1-2-2-1)", () => {
    let state = stripBase(freshGame(), "B");
    state = { ...state, players: { ...state.players, B: { ...state.players.B, shields: [] } } };
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01);

    state = runToDamageStep(state, attackerId, "player");
    state = resolveDamageStep(state);

    expect(state.gameOver).toEqual({ winner: "A", reason: "noShieldsBattleDamage" });
  });

  it("Pilot pareado segue a Unit destruída pro trash (Comprehensive Rules 3-3-6)", () => {
    let state = stripBase(freshGame(), "B");
    const pilotId = place(state, "B", VANILLA_CARD_DEFS.PILOT_01, { zone: "battleArea" });
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, { rested: true, pairedPilotId: pilotId });
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.HEAVY_01);

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(state.players.B.trash.some((c) => c.instanceId === defenderId)).toBe(true);
    expect(state.players.B.trash.some((c) => c.instanceId === pilotId)).toBe(true);
  });

  it("resolveBattleEndStep encerra o combate e limpa modificadores 'thisBattle'", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02, {
      statModifiers: [{ stat: "ap", amount: 3, duration: "thisBattle", appliedOnTurn: 1 }],
    });

    state = runToDamageStep(state, attackerId, "player");
    state = resolveDamageStep(state);
    state = resolveBattleEndStep(state);

    expect(state.combat).toBeNull();
    expect(findCard(state, attackerId).statModifiers).toHaveLength(0);
  });
});

describe("<Support N> — ação de Main Phase (docs/18)", () => {
  it("resta a fonte e dá +N AP endOfTurn no alvo", () => {
    let state = freshGame();
    const sourceId = place(state, "A", VANILLA_CARD_DEFS.SUPPORT_01);
    const targetId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01);

    state = activateSupport(state, sourceId, targetId);

    expect(findCard(state, sourceId).rested).toBe(true);
    const target = findCard(state, targetId);
    expect(target.statModifiers).toEqual([{ stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: 1 }]);
  });

  it("【Once per Turn】 impede ativar a mesma instância duas vezes no turno", () => {
    let state = freshGame();
    const sourceId = place(state, "A", VANILLA_CARD_DEFS.SUPPORT_01);
    const targetA = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01);
    const targetB = place(state, "A", VANILLA_CARD_DEFS.VANILLA_02);

    // precisa reativar (Support resta a fonte) — força active de novo só pra testar a trava de "once per turn",
    // não a trava de "rested"
    state = activateSupport(state, sourceId, targetA);
    state = { ...state, players: { ...state.players, A: { ...state.players.A, battleArea: state.players.A.battleArea.map((c) => (c.instanceId === sourceId ? { ...c, rested: false } : c)) } } };

    expect(() => activateSupport(state, sourceId, targetB)).toThrow(/Once per Turn/);
  });
});

describe("Link Unit ataca no turno em que foi deployada (Comprehensive Rules 3-2-4 / 3-2-6-3)", () => {
  it("Unit recém-deployada sem Pilot pareado não pode atacar no turno em que entrou em campo", () => {
    const state = freshGame();
    const maFormId = place(state, "A", ST01_CARD_DEFS.GUNDAM_MA_FORM, { enteredZoneOnTurn: state.turnNumber });

    expect(() => declareAttack(state, maFormId, "player")).toThrow(/Comprehensive Rules 3-2-4/);
  });

  it("Unit recém-deployada pareada com Pilot que NÃO satisfaz a link condition ainda não pode atacar", () => {
    const state = freshGame();
    // Suletta Mercury não casa com o link "[Amuro Ray]" da MA Form — pareamento
    // em si é livre (3-3-1/3-3-4), mas não vira Link Unit (3-2-6).
    const sulettaId = place(state, "A", ST01_CARD_DEFS.SULETTA_MERCURY);
    const maFormId = place(state, "A", ST01_CARD_DEFS.GUNDAM_MA_FORM, {
      enteredZoneOnTurn: state.turnNumber,
      pairedPilotId: sulettaId,
    });

    expect(() => declareAttack(state, maFormId, "player")).toThrow(/Comprehensive Rules 3-2-4/);
  });

  it("Link Unit por nome de Pilot (kind: pilotName) pode atacar no turno em que foi deployada", () => {
    const state = freshGame();
    // ST01-002 Gundam (MA Form): link "[Amuro Ray]" — casa por substring no nome do Pilot pareado.
    const amuroId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY);
    const maFormId = place(state, "A", ST01_CARD_DEFS.GUNDAM_MA_FORM, {
      enteredZoneOnTurn: state.turnNumber,
      pairedPilotId: amuroId,
    });

    const next = declareAttack(state, maFormId, "player");
    expect(next.combat?.attackerId).toBe(maFormId);
  });

  it("Link Unit por trait (kind: trait) pode atacar no turno em que foi deployada", () => {
    const state = freshGame();
    // ST02-007 Leo: link "(OZ) Trait" — casa por trait do Pilot pareado, não por nome específico.
    const zechsId = place(state, "A", ST02_CARD_DEFS.ZECHS_MERQUISE); // trait OZ
    const leoId = place(state, "A", ST02_CARD_DEFS.LEO, {
      enteredZoneOnTurn: state.turnNumber,
      pairedPilotId: zechsId,
    });

    const next = declareAttack(state, leoId, "player");
    expect(next.combat?.attackerId).toBe(leoId);
  });
});
