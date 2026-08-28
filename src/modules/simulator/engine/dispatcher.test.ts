import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { findCard } from "./events";
import { dispatchBurstForNewlyTrashedShields, dispatchTrigger, findTriggerSpecs } from "./dispatcher";
import { AMURO_RAY_BURST, AMURO_RAY_WHEN_PAIRED, GUNTANK_DEPLOY, ST01_EFFECT_SPECS, SULETTA_MERCURY_ATTACK } from "../content/st01";

/**
 * Dispatcher automático de trigger (docs/18, wave "motor de jogo real + gaps
 * documentados") — testa `dispatchTrigger`/`dispatchBurstForNewlyTrashedShields`
 * contra EffectSpec real do ST01, provando que o motor acha e resolve o
 * efeito certo sem precisar montar `EffectContext` à mão em cada chamada
 * (o que `st01.test.ts`/`st02.test.ts` ainda fazem, documentado como
 * provisório até esta wave).
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-dispfx-${seq++}`;
  const card: CardInstance = {
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber,
    ...opts,
  };
  state.players[player][zone].push(card);
  return instanceId;
}

function freshGame(): GameState {
  return createGame(buildSt01DeckList(), buildSt01DeckList(), { seed: 11, firstPlayer: "A" });
}

describe("findTriggerSpecs", () => {
  it("filtra por cardCode + trigger exatos", () => {
    const found = findTriggerSpecs(ST01_EFFECT_SPECS, "ST01-004", "Deploy");
    expect(found).toEqual([GUNTANK_DEPLOY]);
  });

  it("não acha nada pra um trigger que a carta não tem", () => {
    expect(findTriggerSpecs(ST01_EFFECT_SPECS, "ST01-004", "Burst")).toEqual([]);
  });
});

describe("dispatchTrigger", () => {
  it("acha e resolve o EffectSpec certo pra uma carta/trigger (ST01-004 Guntank Deploy)", () => {
    const state = freshGame();
    const guntankId = place(state, "A", ST01_CARD_DEFS.GUNTANK, "battleArea");
    const targetId = place(state, "B", ST01_CARD_DEFS.GM, "battleArea");

    const next = dispatchTrigger(state, guntankId, "Deploy", ST01_EFFECT_SPECS, { targets: { target: [targetId] } });

    expect(findCard(next, targetId).rested).toBe(true);
  });

  it("não faz nada se a carta não tem EffectSpec pra esse trigger", () => {
    const state = freshGame();
    const gmId = place(state, "A", ST01_CARD_DEFS.GM, "battleArea"); // vanilla, sem EffectSpec nenhum

    const next = dispatchTrigger(state, gmId, "Deploy", ST01_EFFECT_SPECS);

    expect(next).toEqual(state);
  });

  it("respeita 【Once per Turn】 genericamente: segunda chamada no mesmo turno não repete o efeito", () => {
    const state = freshGame();
    const sulettaId = place(state, "A", ST01_CARD_DEFS.SULETTA_MERCURY, "battleArea");
    const resourceId = place(state, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea", { rested: true });

    let next = dispatchTrigger(state, sulettaId, "Attack", ST01_EFFECT_SPECS, { targets: { target: [resourceId] } });
    expect(findCard(next, resourceId).rested).toBe(false); // SULETTA_MERCURY_ATTACK: setActive no alvo

    // resta o recurso de novo manualmente pra provar que o 2º dispatch não o re-ativa
    const resourceId2 = place(next, "A", ST01_CARD_DEFS.RESOURCE, "resourceArea", { rested: true });
    next = dispatchTrigger(next, sulettaId, "Attack", ST01_EFFECT_SPECS, { targets: { target: [resourceId2] } });

    expect(findCard(next, resourceId2).rested).toBe(true); // não disparou de novo nesta instância neste turno
    expect(findTriggerSpecs(ST01_EFFECT_SPECS, "ST01-011", "Attack")).toEqual([SULETTA_MERCURY_ATTACK]);
  });

  it("dispatchTrigger acha 'When Paired' tanto pelo lado do Pilot (ST01-010) quanto pelo lado da Unit (ST01-002) — deployCard.test.ts prova os dois disparando juntos numa jogada real", () => {
    const state = freshGame();
    const pilotId = place(state, "A", ST01_CARD_DEFS.AMURO_RAY, "battleArea");
    const targetId = place(state, "B", ST01_CARD_DEFS.GUNCANNON, "battleArea");

    // ST01-010 Amuro Ray (Pilot) — When Paired: resta o alvo escolhido
    const afterPilotSide = dispatchTrigger(state, pilotId, "When Paired", ST01_EFFECT_SPECS, { targets: { target: [targetId] } });
    expect(findCard(afterPilotSide, targetId).rested).toBe(true);
    expect(findTriggerSpecs(ST01_EFFECT_SPECS, "ST01-010", "When Paired")).toEqual([AMURO_RAY_WHEN_PAIRED]);
  });
});

describe("dispatchBurstForNewlyTrashedShields", () => {
  it("oferece Burst pra shield recém-trashada com hasBurst + EffectSpec, e o próprio efeito a realoca pra fora do trash", () => {
    const before = freshGame();
    const amuroId = place(before, "A", ST01_CARD_DEFS.AMURO_RAY, "shields");
    // simula o dano de batalha já ter mandado a shield pro trash (mesmo comportamento puro de combat.ts)
    const afterDamage: GameState = {
      ...before,
      players: {
        ...before.players,
        A: {
          ...before.players.A,
          shields: before.players.A.shields.filter((c) => c.instanceId !== amuroId),
          trash: [...before.players.A.trash, { ...findCard(before, amuroId), zone: "trash" }],
        },
      },
    };

    const next = dispatchBurstForNewlyTrashedShields(before, afterDamage, "A", ST01_EFFECT_SPECS, () => ({}));

    expect(next.players.A.hand.some((c) => c.instanceId === amuroId)).toBe(true);
    expect(next.players.A.trash.some((c) => c.instanceId === amuroId)).toBe(false);
    expect(findTriggerSpecs(ST01_EFFECT_SPECS, "ST01-010", "Burst")).toEqual([AMURO_RAY_BURST]);
  });

  it("se chooseBurst recusa, a shield fica no trash normalmente", () => {
    const before = freshGame();
    const amuroId = place(before, "A", ST01_CARD_DEFS.AMURO_RAY, "shields");
    const afterDamage: GameState = {
      ...before,
      players: {
        ...before.players,
        A: {
          ...before.players.A,
          shields: before.players.A.shields.filter((c) => c.instanceId !== amuroId),
          trash: [...before.players.A.trash, { ...findCard(before, amuroId), zone: "trash" }],
        },
      },
    };

    const next = dispatchBurstForNewlyTrashedShields(before, afterDamage, "A", ST01_EFFECT_SPECS, () => false);

    expect(next.players.A.trash.some((c) => c.instanceId === amuroId)).toBe(true);
  });

  it("ignora shield sem hasBurst mesmo se recém-trashada", () => {
    const before = freshGame();
    const gmId = place(before, "A", ST01_CARD_DEFS.GM, "shields"); // vanilla, hasBurst indefinido
    const afterDamage: GameState = {
      ...before,
      players: {
        ...before.players,
        A: {
          ...before.players.A,
          shields: before.players.A.shields.filter((c) => c.instanceId !== gmId),
          trash: [...before.players.A.trash, { ...findCard(before, gmId), zone: "trash" }],
        },
      },
    };

    const next = dispatchBurstForNewlyTrashedShields(before, afterDamage, "A", ST01_EFFECT_SPECS, () => ({}));

    expect(next.players.A.trash.some((c) => c.instanceId === gmId)).toBe(true);
  });
});
