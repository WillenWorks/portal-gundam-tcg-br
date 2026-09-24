import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildVanillaDeckList, VANILLA_CARD_DEFS } from "../fixtures/vanillaDeck";
import { ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { ST02_CARD_DEFS } from "../fixtures/st02Deck";
import { ST03_CARD_DEFS } from "../fixtures/st03Deck";
import { ST04_CARD_DEFS } from "../fixtures/st04Deck";
import { GD01_CARD_DEFS } from "../content/gd01";
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
import { applyEvent, findCard } from "./events";
import { applyPlayerAction } from "./actions";
import { defaultPredicateResolver, defaultTargetFilterResolver } from "../content/predicates";
import { ST05_CARD_DEFS, buildSt05DeckList } from "../fixtures/st05Deck";
import { placeCard } from "./__testkit__/cardHarness";
import { getCardDefByCode } from "../content/allCardDefs";

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

/**
 * Igual a `runToDamageStep`, mas o 2º `passAction` passa pela camada de
 * `actions.ts` (`applyPlayerAction`) em vez do `passAction` puro de
 * `combat.ts` — dispara `resolveDamageStep` + Burst/Destroyed + `finishDamageStep`
 * (docs/47 Fase 6), então o retorno pode já vir com uma pausa
 * `PendingDecision.abilityResolution` (escolha de gatilho de combate) ou já
 * com o Battle End resolvido, dependendo do que a batalha exigir.
 */
function runToDamageStepViaActions(state: GameState, attackerId: string, target: Parameters<typeof declareAttack>[2]): GameState {
  let next = declareAttack(state, attackerId, target);
  next = proceedToBlockStep(next);
  next = skipBlock(next);
  next = passAction(next, next.combat!.defendingPlayer);
  return applyPlayerAction(next, next.combat!.attackingPlayer, { kind: "passAction" }, [], defaultPredicateResolver, defaultTargetFilterResolver);
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

  it("<Breach N> com N > 1 ainda quebra só 1 shield (bug reportado em teste real: motor removia N shields de uma vez, ex. <Breach 3>/Simultaneous Fire)", () => {
    let state = stripBase(freshGame(), "B");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01); // AP1/HP1, sem Breach nativo
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, { rested: true }); // AP1/HP1
    state = applyEvent(state, {
      type: "GRANT_KEYWORD",
      instanceId: attackerId,
      grant: { keyword: "Breach 3", duration: "endOfTurn", appliedOnTurn: state.turnNumber },
    });
    const before = state.players.B.shields.length;
    expect(before).toBeGreaterThanOrEqual(3); // senão o teste não provaria nada (shield insuficiente pra distinguir 1 de 3)

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(state.players.B.trash.some((c) => c.instanceId === defenderId)).toBe(true);
    // Comprehensive Rules: <Breach N> causa N de dano no 1º shield, mas um Shield
    // que recebe 1+ de dano é destruído inteiro -- por isso sempre 1 shield cai,
    // nunca N, não importa quão alto for N.
    expect(state.players.B.shields).toHaveLength(before - 1);
  });

  // Glossário (docs/17): <Breach X> causa X de dano na PRIMEIRA carta da área de escudo
  // (a Base, se houver; senão o escudo do topo). Sem Base nem escudo, não ativa.
  it("<Breach N> com Base em campo: a Base recebe N de dano (escudos intactos)", () => {
    let state = freshGame();
    state.players.B.baseSection = [];
    const baseDef: CardDef = { code: "BR-BASE", nameEn: "Base", cardType: "BASE", color: "white", level: 1, cost: 1, hp: 5 };
    const baseId = placeCard(state, "B", baseDef, "baseSection");
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.VANILLA_01);
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, { rested: true });
    state = applyEvent(state, {
      type: "GRANT_KEYWORD",
      instanceId: attackerId,
      grant: { keyword: "Breach 3", duration: "endOfTurn", appliedOnTurn: state.turnNumber },
    });
    const shieldsBefore = state.players.B.shields.length;

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(state.players.B.trash.some((c) => c.instanceId === defenderId)).toBe(true);
    expect(findCard(state, baseId).damage).toBe(3);
    expect(state.players.B.shields).toHaveLength(shieldsBefore);
  });

  it("<Breach N> sem Base e sem escudo: não ativa e NÃO encerra a partida", () => {
    let state = stripBase(freshGame(), "B");
    state = { ...state, players: { ...state.players, B: { ...state.players.B, shields: [] } } };
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.BREACH_01);
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, { rested: true });

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(state.players.B.trash.some((c) => c.instanceId === defenderId)).toBe(true);
    expect(state.gameOver).toBeNull();
  });

  it("GD02-001 Psycho Gundam (During Pair Cyber-Newtype): escudo destruído pelo próprio <Breach 3> → recupera 2 HP", () => {
    let state = stripBase(freshGame(), "B");
    const pilotId = place(state, "A", getCardDefByCode("GD02-085")!); // Four Murasame (Titans, Cyber-Newtype)
    const psychoId = place(state, "A", getCardDefByCode("GD02-001")!, { pairedPilotId: pilotId, damage: 3 });
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, { rested: true });
    const shieldsBefore = state.players.B.shields.length;

    state = runToDamageStep(state, psychoId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(state.players.B.shields).toHaveLength(shieldsBefore - 1);
    // tomou 1 do defensor (AP1) e curou 2: 3 + 1 − 2 = 2
    expect(findCard(state, psychoId).damage).toBe(2);
  });

  it("GD02-001 Psycho Gundam: Unit (Titans) aliada que destrói a Base inimiga (carta da área de escudo) também cura", () => {
    let state = freshGame();
    state.players.B.baseSection = [];
    placeCard(state, "B", { code: "BR-BASE-1", nameEn: "Base", cardType: "BASE", color: "white", level: 1, cost: 1, hp: 1 }, "baseSection");
    const pilotId = place(state, "A", getCardDefByCode("GD02-085")!);
    const psychoId = place(state, "A", getCardDefByCode("GD02-001")!, { pairedPilotId: pilotId, damage: 3, rested: true });
    const titansId = place(state, "A", { ...VANILLA_CARD_DEFS.VANILLA_01, code: "BR-TITANS", traits: ["Titans"] });

    state = runToDamageStep(state, titansId, "player");
    state = resolveDamageStep(state);

    expect(state.players.B.baseSection).toHaveLength(0);
    expect(findCard(state, psychoId).damage).toBe(1);
  });

  it("GD02-002 Gundam Epyon (During Link, Once per Turn): Unit aliada destrói Unit inimiga em batalha no seu turno → Epyon fica active (só 1×)", () => {
    let state = stripBase(freshGame(), "B");
    const zechsId = place(state, "A", getCardDefByCode("ST02-011")!);
    const epyonId = place(state, "A", getCardDefByCode("GD02-002")!, { pairedPilotId: zechsId, rested: true });
    const attackerId = place(state, "A", VANILLA_CARD_DEFS.BREACH_01); // AP3/HP3
    const defenderId = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, { rested: true });

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);
    state = resolveBattleEndStep(state);

    expect(findCard(state, epyonId).rested).toBe(false);
    // 【Once per Turn】: segunda destruição no mesmo turno não reativa de novo
    state = applyEvent(state, { type: "REST_CARD", instanceId: epyonId });
    const second = place(state, "A", VANILLA_CARD_DEFS.BREACH_01);
    const defender2 = place(state, "B", VANILLA_CARD_DEFS.VANILLA_01, { rested: true });
    state = runToDamageStep(state, second, { unitId: defender2 });
    state = resolveDamageStep(state);
    expect(findCard(state, epyonId).rested).toBe(true);
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
    expect(target.statModifiers).toEqual([{ stat: "ap", amount: 1, duration: "endOfTurn", appliedOnTurn: 1, appliedBy: "A" }]);
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

  it("GD01-046 Buster Gundam (During Pair Coordinator, Once per Turn): usar o próprio <Support> num alvo (ZAFT) reativa a fonte na hora, cancelando o rest (Lote 5, docs/debates 2026-09-13)", () => {
    let state = freshGame();
    const dearkaId = place(state, "A", GD01_CARD_DEFS["GD01-095"]); // Dearka Elthman, (Coordinator)
    const busterId = place(state, "A", GD01_CARD_DEFS["GD01-046"], { pairedPilotId: dearkaId });
    findCard(state, dearkaId).pairedUnitId = busterId;
    const zaftTargetId = place(state, "A", GD01_CARD_DEFS["GD01-064"]); // DINN, (ZAFT)

    state = activateSupport(state, busterId, zaftTargetId);

    expect(findCard(state, busterId).rested).toBe(false); // reativada na hora
    expect(findCard(state, zaftTargetId).statModifiers).toContainEqual(expect.objectContaining({ stat: "ap" }));
  });

  it("GD01-046: sem Pilot (Coordinator) pareado, o rest normal de <Support> continua valendo", () => {
    let state = freshGame();
    const busterId = place(state, "A", GD01_CARD_DEFS["GD01-046"]); // sem Pilot pareado
    const zaftTargetId = place(state, "A", GD01_CARD_DEFS["GD01-064"]);

    state = activateSupport(state, busterId, zaftTargetId);

    expect(findCard(state, busterId).rested).toBe(true);
  });

  it("GD01-046: mirando alvo que NÃO é (ZAFT), o rest normal continua valendo", () => {
    let state = freshGame();
    const dearkaId = place(state, "A", GD01_CARD_DEFS["GD01-095"]);
    const busterId = place(state, "A", GD01_CARD_DEFS["GD01-046"], { pairedPilotId: dearkaId });
    findCard(state, dearkaId).pairedUnitId = busterId;
    const nonZaftTargetId = place(state, "A", GD01_CARD_DEFS["GD01-035"]); // Zaku Ⅱ, (Zeon)

    state = activateSupport(state, busterId, nonZaftTargetId);

    expect(findCard(state, busterId).rested).toBe(true);
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

describe("cláusulas de carta ST03/ST04 no combate (docs/43 §4)", () => {
  it("ST03-001 Sinanju — destruir shield inimigo em batalha PAUSA pedindo escolha real entre as Units inimigas legais (docs/47 Fase 6, deferred.ts fechado)", () => {
    const state = stripBase(freshGame(), "B");
    const sinanjuId = place(state, "A", ST03_CARD_DEFS.SINANJU); // AP5
    const enemy1Id = place(state, "B", ST03_CARD_DEFS.ANGELOS_GEARA_ZULU, { rested: true }); // HP3, sobrevive a 2
    const enemy2Id = place(state, "B", ST03_CARD_DEFS.GEARA_ZULU, { rested: true }); // HP2, sobrevive a 2
    const shieldsBefore = state.players.B.shields.length;

    const afterAction = runToDamageStepViaActions(state, sinanjuId, "player");

    expect(afterAction.players.B.shields).toHaveLength(shieldsBefore - 1);
    const decision = afterAction.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.legalTargets.slice().sort()).toEqual([enemy1Id, enemy2Id].sort());
    // ainda não resolveu — nenhuma das duas tomou dano.
    expect(findCard(afterAction, enemy1Id).damage).toBe(0);
    expect(findCard(afterAction, enemy2Id).damage).toBe(0);

    // escolhe enemy1 (HP3, sobrevive a 2) — GEARA_ZULU (enemy2, HP2) morreria e teria
    // o damage resetado a 0 pelo DESTROY_CARD, o que confundiria a asserção abaixo.
    const resolved = applyPlayerAction(
      afterAction,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [enemy1Id] }] },
      [],
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(findCard(resolved, enemy1Id).damage).toBe(2); // só a Unit ESCOLHIDA toma dano
    expect(findCard(resolved, enemy2Id).damage).toBe(0);
    expect(resolved.pendingDecision.A).toBeNull();
    expect(resolved.combat).toBeNull(); // Battle End já rodou (finishDamageStep)
  });

  it("ST03-001 Sinanju — dano do combatTrigger, ao ser resolvido, mata a Unit inimiga escolhida e o Pilot pareado dela também vai pro trash (CR 3-3-6, docs/47 Fase 2 + Fase 6)", () => {
    const state = stripBase(freshGame(), "B");
    const sinanjuId = place(state, "A", ST03_CARD_DEFS.SINANJU); // AP5
    const enemyPilotId = place(state, "B", ST03_CARD_DEFS.CHAR_AZNABLE); // hp:1 impresso -> soma no efetivo da Unit pareada (CR 3-3-5)
    // GEARA_ZULU (HP2) pareada com Char Aznable (HP+1) = HP efetivo 3; 1 de dano prévio + 2 do combatTrigger = letal.
    const enemyUnitId = place(state, "B", ST03_CARD_DEFS.GEARA_ZULU, { rested: true, pairedPilotId: enemyPilotId, damage: 1 });
    findCard(state, enemyPilotId).pairedUnitId = enemyUnitId;

    const afterAction = runToDamageStepViaActions(state, sinanjuId, "player");
    const decision = afterAction.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.legalTargets).toEqual([enemyUnitId]); // único inimigo em campo

    const resolved = applyPlayerAction(
      afterAction,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [enemyUnitId] }] },
      [],
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(resolved.players.B.trash.some((c) => c.instanceId === enemyUnitId)).toBe(true);
    expect(resolved.players.B.trash.some((c) => c.instanceId === enemyPilotId)).toBe(true);
    expect(resolved.pendingDecision.A).toBeNull();
  });

  it("ST03-001 Sinanju — sem Unit inimiga legal: não pausa, combate termina normalmente", () => {
    const state = stripBase(freshGame(), "B");
    const sinanjuId = place(state, "A", ST03_CARD_DEFS.SINANJU);

    const afterAction = runToDamageStepViaActions(state, sinanjuId, "player");

    expect(afterAction.pendingDecision.A).toBeNull();
    expect(afterAction.combat).toBeNull();
  });

  it("ST03-001 Sinanju — Base absorve o dano: nenhum shield cai, nenhum dano colateral", () => {
    let state = freshGame(); // B mantém a EX Base
    const sinanjuId = place(state, "A", ST03_CARD_DEFS.SINANJU);
    const enemyId = place(state, "B", ST03_CARD_DEFS.ANGELOS_GEARA_ZULU, { rested: true });

    state = runToDamageStep(state, sinanjuId, "player");
    state = resolveDamageStep(state);

    expect(findCard(state, enemyId).damage).toBe(0);
  });

  it("ST03-014 The Blue Giant — Unit amiga protegida não recebe dano de atacante com AP<=2", () => {
    let state = { ...freshGame(), activePlayer: "B" as PlayerId };
    state = stripBase(state, "A");
    const defenderId = place(state, "A", ST03_CARD_DEFS.GEARA_ZULU, { rested: true }); // AP3/HP2
    const attackerId = place(state, "B", ST03_CARD_DEFS.GAZA_D); // AP2/HP1

    state = declareAttack(state, attackerId, { unitId: defenderId });
    state = applyEvent(state, { type: "SET_UNIT_DAMAGE_PROTECTION", instanceId: defenderId, maxAttackerAp: 2 });
    state = proceedToBlockStep(state);
    state = skipBlock(state);
    state = passAction(state, state.combat!.defendingPlayer);
    state = passAction(state, state.combat!.attackingPlayer);
    state = resolveDamageStep(state);

    expect(findCard(state, defenderId).damage).toBe(0); // protegida (atacante AP2)
    expect(state.players.B.trash.some((c) => c.instanceId === attackerId)).toBe(true); // atacante recebeu o contra-ataque (AP3 >= HP1)
  });

  it("ST03-014 The Blue Giant — proteção não vale contra atacante com AP>=3", () => {
    let state = { ...freshGame(), activePlayer: "B" as PlayerId };
    state = stripBase(state, "A");
    const defenderId = place(state, "A", ST03_CARD_DEFS.DRA_C, { rested: true }); // HP2
    const attackerId = place(state, "B", ST03_CARD_DEFS.GEARA_ZULU); // AP3

    state = declareAttack(state, attackerId, { unitId: defenderId });
    state = applyEvent(state, { type: "SET_UNIT_DAMAGE_PROTECTION", instanceId: defenderId, maxAttackerAp: 2 });
    state = proceedToBlockStep(state);
    state = skipBlock(state);
    state = passAction(state, state.combat!.defendingPlayer);
    state = passAction(state, state.combat!.attackingPlayer);
    state = resolveDamageStep(state);

    expect(state.players.A.trash.some((c) => c.instanceId === defenderId)).toBe(true); // não protegida (AP3 > 2)
  });

  it("ST04-011 Athrun Zala — attackTargetRelaxUntilTurn deixa mirar Unit inimiga ativa Lv<=5", () => {
    const state = { ...freshGame() };
    const aegisId = place(state, "A", ST04_CARD_DEFS.AEGIS_GUNDAM, {
      attackTargetRelaxUntilTurn: { maxLevel: 5, turn: state.turnNumber },
    });
    const activeEnemyId = place(state, "B", ST04_CARD_DEFS.STRIKE_GUNDAM); // Lv.4, active

    const next = declareAttack(state, aegisId, { unitId: activeEnemyId });
    expect(next.combat?.currentTarget).toEqual({ unitId: activeEnemyId });
  });

  it("ST04-011 Athrun Zala — a concessão não vale pra Unit ativa Lv.6+", () => {
    const state = { ...freshGame() };
    const aegisId = place(state, "A", ST04_CARD_DEFS.AEGIS_GUNDAM, {
      attackTargetRelaxUntilTurn: { maxLevel: 5, turn: state.turnNumber },
    });
    const bigEnemyId = place(state, "B", ST03_CARD_DEFS.SINANJU); // Lv.6, active

    expect(() => declareAttack(state, aegisId, { unitId: bigEnemyId })).toThrow(/rested/);
  });

  it("grantAttackTargetRelax por AP (GD01-043/GD01-110, Lote 1 docs/debates 2026-09-13) — deixa mirar Unit inimiga ativa com AP<=6", () => {
    const state = { ...freshGame() };
    const aegisId = place(state, "A", ST04_CARD_DEFS.AEGIS_GUNDAM, {
      attackTargetRelaxUntilTurn: { maxAp: 6, turn: state.turnNumber },
    });
    const activeEnemyId = place(state, "B", { ...ST04_CARD_DEFS.STRIKE_GUNDAM, ap: 6 }); // AP6, active

    const next = declareAttack(state, aegisId, { unitId: activeEnemyId });
    expect(next.combat?.currentTarget).toEqual({ unitId: activeEnemyId });
  });

  it("grantAttackTargetRelax por AP — a concessão não vale pra Unit ativa com AP 7+", () => {
    const state = { ...freshGame() };
    const aegisId = place(state, "A", ST04_CARD_DEFS.AEGIS_GUNDAM, {
      attackTargetRelaxUntilTurn: { maxAp: 6, turn: state.turnNumber },
    });
    const bigApEnemyId = place(state, "B", { ...ST04_CARD_DEFS.STRIKE_GUNDAM, ap: 7 }); // AP7, active

    expect(() => declareAttack(state, aegisId, { unitId: bigApEnemyId })).toThrow(/rested/);
  });

  it("ST04-015 Archangel — cannotAttackUntilTurn barra a declaração de ataque no mesmo turno", () => {
    const state = { ...freshGame() };
    const unitId = place(state, "A", ST04_CARD_DEFS.MOEBIUS, { cannotAttackUntilTurn: state.turnNumber });
    expect(() => declareAttack(state, unitId, "player")).toThrow(/não pode atacar neste turno/);
  });

  it("ST04-015 Archangel — a proibição não vale num turno futuro", () => {
    const state = { ...freshGame(), turnNumber: 5 };
    const unitId = place(state, "A", ST04_CARD_DEFS.MOEBIUS, { cannotAttackUntilTurn: 3 });
    const next = declareAttack(state, unitId, "player");
    expect(next.combat?.attackerId).toBe(unitId);
  });

  it("GD01-094 Yzak Jule (During Pair, Once per Turn): destruir um Link Unit inimigo em batalha compra 1 carta (Lote 5, docs/debates 2026-09-13)", () => {
    let state = stripBase(freshGame(), "B");
    const yzakId = place(state, "A", GD01_CARD_DEFS["GD01-094"]);
    const attackerId = place(state, "A", GD01_CARD_DEFS["GD01-045"], { pairedPilotId: yzakId }); // Duel Gundam (Assault Shroud), AP4/HP4, link "Yzak Jule"
    findCard(state, yzakId).pairedUnitId = attackerId;

    const maridaId = place(state, "B", GD01_CARD_DEFS["GD01-093"]);
    const enemyId = place(state, "B", GD01_CARD_DEFS["GD01-044"], { rested: true, pairedPilotId: maridaId }); // Kshatriya, AP5/HP4, link "Marida Cruz"
    findCard(state, maridaId).pairedUnitId = enemyId;
    const handBefore = state.players.A.hand.length;

    state = runToDamageStep(state, attackerId, { unitId: enemyId });
    state = resolveDamageStep(state);

    expect(state.players.B.trash.some((c) => c.instanceId === enemyId)).toBe(true); // inimigo (Link Unit) destruído
    expect(state.players.A.hand).toHaveLength(handBefore + 1); // comprou 1
  });

  it("GD01-094: NÃO dispara se o inimigo destruído não é Link Unit (sem Pilot pareado)", () => {
    let state = stripBase(freshGame(), "B");
    const yzakId = place(state, "A", GD01_CARD_DEFS["GD01-094"]);
    const attackerId = place(state, "A", GD01_CARD_DEFS["GD01-045"], { pairedPilotId: yzakId });
    findCard(state, yzakId).pairedUnitId = attackerId;

    const enemyId = place(state, "B", GD01_CARD_DEFS["GD01-064"], { rested: true }); // DINN, sem Pilot pareado
    const handBefore = state.players.A.hand.length;

    state = runToDamageStep(state, attackerId, { unitId: enemyId });
    state = resolveDamageStep(state);

    expect(state.players.B.trash.some((c) => c.instanceId === enemyId)).toBe(true);
    expect(state.players.A.hand).toHaveLength(handBefore); // não comprou
  });

  // "During your turn" só é satisfeito enquanto a Unit pareada com Wufei ESTÁ ATACANDO
  // (o defensor nunca age no próprio turno) — protege do CONTRA-dano do defensor, não
  // do dano que a própria Unit causa.
  it("GD01-091 Chang Wufei (Pilot, innateDamageProtection): a Unit pareada (atacando, com <Breach>) não recebe contra-dano de defensor com AP<=3 (Lote 5)", () => {
    let state = stripBase(freshGame(), "A");
    const wufeiId = place(state, "A", GD01_CARD_DEFS["GD01-091"]);
    const attackerId = place(state, "A", GD01_CARD_DEFS["GD01-064"], {
      // DINN, AP3/HP2 — sem Breach própria; concede via keywordGrants pra isolar o teste.
      pairedPilotId: wufeiId,
      keywordGrants: [{ keyword: "Breach", duration: "permanent", appliedOnTurn: 0 }],
    });
    findCard(state, wufeiId).pairedUnitId = attackerId;
    const defenderId = place(state, "B", { ...GD01_CARD_DEFS["GD01-064"], ap: 3 }, { rested: true }); // AP3 <= 3

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(findCard(state, attackerId).damage).toBe(0); // contra-dano prevenido
    expect(state.players.A.battleArea.some((c) => c.instanceId === attackerId)).toBe(true); // sobreviveu
  });

  it("GD01-091: NÃO protege contra defensor com AP > 3", () => {
    let state = stripBase(freshGame(), "A");
    const wufeiId = place(state, "A", GD01_CARD_DEFS["GD01-091"]);
    const attackerId = place(state, "A", { ...GD01_CARD_DEFS["GD01-064"], hp: 10 }, {
      // HP alto pra sobreviver e isolar a asserção de dano (sem confundir com morte/reset de dano).
      pairedPilotId: wufeiId,
      keywordGrants: [{ keyword: "Breach", duration: "permanent", appliedOnTurn: 0 }],
    });
    findCard(state, wufeiId).pairedUnitId = attackerId;
    const defenderId = place(state, "B", { ...GD01_CARD_DEFS["GD01-064"], ap: 4 }, { rested: true }); // AP4 > 3

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(findCard(state, attackerId).damage).toBe(4); // contra-dano normal, sem proteção
  });

  it("GD01-091: NÃO protege se a Unit pareada (atacante) não tem <Breach>", () => {
    let state = stripBase(freshGame(), "A");
    const wufeiId = place(state, "A", GD01_CARD_DEFS["GD01-091"]);
    const attackerId = place(state, "A", { ...GD01_CARD_DEFS["GD01-064"], hp: 10 }, { pairedPilotId: wufeiId }); // sem Breach
    findCard(state, wufeiId).pairedUnitId = attackerId;
    const defenderId = place(state, "B", { ...GD01_CARD_DEFS["GD01-064"], ap: 3 }, { rested: true });

    state = runToDamageStep(state, attackerId, { unitId: defenderId });
    state = resolveDamageStep(state);

    expect(findCard(state, attackerId).damage).toBe(3); // sem <Breach>, sem proteção
  });
});

describe("ST05-011 Akihiro Altland — During Link + retrieve de trash via combate (docs/47 Fase 6, deferred.ts fechado)", () => {
  function freshSt05Game(): GameState {
    const state = createGame(buildSt05DeckList(), buildSt05DeckList(), { seed: 9, firstPlayer: "A" });
    return { ...state, phase: "main" };
  }

  it("destrói inimigo em batalha com Link satisfeito: PAUSA pedindo escolha real na lixeira, resolve movendo a carta pra mão", () => {
    const state = stripBase(freshSt05Game(), "B");
    const pilotId = place(state, "A", ST05_CARD_DEFS.AKIHIRO_ALTLAND);
    const attackerId = place(state, "A", ST05_CARD_DEFS.GUNDAM_GUSION_REBAKE, { pairedPilotId: pilotId }); // AP3, link com Akihiro Altland
    findCard(state, pilotId).pairedUnitId = attackerId;
    const trashCardId = placeCard(state, "A", ST05_CARD_DEFS.GRAZE_CUSTOM, "trash"); // Tekkadan, Lv.2
    const enemyId = place(state, "B", ST05_CARD_DEFS.GRAZE, { rested: true }); // AP2/HP2, morre a 3 de dano

    const afterAction = runToDamageStepViaActions(state, attackerId, { unitId: enemyId });

    expect(afterAction.players.B.battleArea.some((c) => c.instanceId === enemyId)).toBe(false); // inimigo morreu
    const decision = afterAction.pendingDecision.A;
    const q = decision?.kind === "abilityResolution" ? decision.queue[0] : undefined;
    expect(q?.trashSearch?.legalTrashIds).toEqual([trashCardId]);
    expect(afterAction.players.A.hand.some((c) => c.instanceId === trashCardId)).toBe(false); // ainda não resolveu

    const resolved = applyPlayerAction(
      afterAction,
      "A",
      { kind: "resolveAbility", resolutions: [{ specId: q!.specId, activate: true, targetIds: [trashCardId] }] },
      [],
      defaultPredicateResolver,
      defaultTargetFilterResolver,
    );
    expect(resolved.players.A.hand.some((c) => c.instanceId === trashCardId)).toBe(true);
    expect(resolved.pendingDecision.A).toBeNull();
    expect(resolved.combat).toBeNull();
  });

  it("sem Link (Piloto errado pareado): não pausa, gatilho não ativa", () => {
    const state = stripBase(freshSt05Game(), "B");
    const wrongPilotId = place(state, "A", ST05_CARD_DEFS.MCGILLIS_FAREED); // não linka com Gundam Gusion Rebake
    const attackerId = place(state, "A", ST05_CARD_DEFS.GUNDAM_GUSION_REBAKE, { pairedPilotId: wrongPilotId });
    findCard(state, wrongPilotId).pairedUnitId = attackerId;
    placeCard(state, "A", ST05_CARD_DEFS.GRAZE_CUSTOM, "trash");
    const enemyId = place(state, "B", ST05_CARD_DEFS.GRAZE, { rested: true });

    const afterAction = runToDamageStepViaActions(state, attackerId, { unitId: enemyId });

    expect(afterAction.players.B.battleArea.some((c) => c.instanceId === enemyId)).toBe(false); // inimigo ainda morre no combate normal
    expect(afterAction.pendingDecision.A).toBeNull();
    expect(afterAction.combat).toBeNull();
  });

  it("sem carta elegível na lixeira: não pausa", () => {
    const state = stripBase(freshSt05Game(), "B");
    const pilotId = place(state, "A", ST05_CARD_DEFS.AKIHIRO_ALTLAND);
    const attackerId = place(state, "A", ST05_CARD_DEFS.GUNDAM_GUSION_REBAKE, { pairedPilotId: pilotId });
    findCard(state, pilotId).pairedUnitId = attackerId;
    const enemyId = place(state, "B", ST05_CARD_DEFS.GRAZE, { rested: true });

    const afterAction = runToDamageStepViaActions(state, attackerId, { unitId: enemyId });

    expect(afterAction.pendingDecision.A).toBeNull();
    expect(afterAction.combat).toBeNull();
  });
});
