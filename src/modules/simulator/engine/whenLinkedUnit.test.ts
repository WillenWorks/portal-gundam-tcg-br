import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { deployCard } from "./deploy";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "./types";
import { hasKeyword } from "./types";
import { findCard } from "./events";
import { buildSt06DeckList, GQUUUUUUX_OMEGA_PSYCOMMU, AMATE_YUZURIHA, GAIAS_RICK_DOM } from "../fixtures/st06Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

/**
 * E1 (revisão semântica GD02/GD03) — o 【When Linked】 da UNIT nunca disparava: o `deploy.ts`
 * só despachava "When Linked" com o Pilot como fonte. ST06-001 GQuuuuuuX (starter!) —
 * "【When Linked】If another friendly (Clan) Unit is in play, this gains <First Strike>".
 */

let seq = 0;
function place(state: GameState, player: PlayerId, def: CardDef, zone: Zone, opts: Partial<CardInstance> = {}): string {
  const instanceId = `${player}-wl-${seq++}`;
  state.players[player][zone].push({
    instanceId,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
    ...opts,
  });
  return instanceId;
}

describe("【When Linked】 de Unit", () => {
  it("ST06-001: parear o Piloto do link dispara o 【When Linked】 da própria Unit", () => {
    const state = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const gqId = place(state, "A", GQUUUUUUX_OMEGA_PSYCOMMU, "battleArea");
    place(state, "A", GAIAS_RICK_DOM, "battleArea"); // "another friendly (Clan) Unit"
    const amateId = place(state, "A", AMATE_YUZURIHA, "hand");
    for (let i = 0; i < 6; i++) place(state, "A", { code: "R", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" }, "resourceArea");

    const next = deployCard(state, "A", amateId, {
      pairWithUnitId: gqId,
      specs: ALL_EFFECT_SPECS,
      predicateResolver: defaultPredicateResolver,
      targetFilterResolver: defaultTargetFilterResolver,
    });

    // ou já resolveu (First Strike concedido) ou está na fila de decisão — nunca fica de fora
    const pending = next.pendingDecision.A;
    const queued =
      (pending?.kind === "abilityResolution" && pending.queue.some((q) => q.specId === "ST06-001-WhenLinked")) ||
      (pending?.kind === "triggerOrder" && pending.triggers.some((t) => t.specId === "ST06-001-WhenLinked"));
    expect(queued || hasKeyword(findCard(next, gqId), "First Strike", next)).toBe(true);
  });
});

describe("E7 — collectDestroyed", () => {
  it("Base que sai da Base Section pro trash entra na lista (o 【Destroyed】 dela podia disparar e nunca disparava)", async () => {
    const { collectDestroyed } = await import("./abilityDispatch");
    const before = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const baseId = place(before, "A", { code: "GD02-126", nameEn: "Base", cardType: "BASE", color: "red", hp: 4 }, "baseSection");
    const after = structuredClone(before);
    const base = after.players.A.baseSection.splice(0, after.players.A.baseSection.length).find((c) => c.instanceId === baseId);
    if (!base) throw new Error("setup");
    base.zone = "trash";
    after.players.A.trash.push(base);
    expect(collectDestroyed(before, after).map((d) => d.instanceId)).toContain(baseId);
  });

  it("Pilot destruído pareado conta como pareado (wasPaired/wasLinkUnit pelo pairedUnitId)", async () => {
    const { collectDestroyed } = await import("./abilityDispatch");
    const before = advanceToMainPhase(createGame(buildSt06DeckList(), buildSt06DeckList(), { seed: 3, firstPlayer: "A" }));
    const unitId = place(before, "A", GQUUUUUUX_OMEGA_PSYCOMMU, "battleArea");
    const pilotId = place(before, "A", AMATE_YUZURIHA, "battleArea", { pairedUnitId: unitId });
    findCard(before, unitId).pairedPilotId = pilotId;
    const after = structuredClone(before);
    const idx = after.players.A.battleArea.findIndex((c) => c.instanceId === pilotId);
    const [pilot] = after.players.A.battleArea.splice(idx, 1);
    pilot.zone = "trash";
    after.players.A.trash.push(pilot);
    const d = collectDestroyed(before, after).find((x) => x.instanceId === pilotId);
    expect(d?.wasPaired).toBe(true);
    expect(d?.wasLinkUnit).toBe(true);
  });
});
