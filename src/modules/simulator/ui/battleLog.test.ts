import { describe, expect, it } from "vitest";
import type { GameEvent } from "@/modules/simulator/engine/types";
import { buildBattleLog, describeEvent } from "./battleLog";
import { createGame } from "@/modules/simulator/engine/setup";
import { advanceToMainPhase } from "@/modules/simulator/engine/phases";
import { viewStateFor } from "@/modules/simulator/engine/viewState";
import { buildVanillaDeckList } from "@/modules/simulator/fixtures/vanillaDeck";

/**
 * "Verifique se o log está sendo exportado corretamente" (2026-09-01) — o feed
 * de batalha é `GameEvent` (motor) → linha PT (`describeEvent`), e o histórico
 * COMPLETO vai no relatório (`reportSituation`, estado inteiro). Aqui travamos
 * a tradução: sem eventos "engolidos" à toa, sem `undefined` no texto.
 */

const nameOf = (id: string) => ({ "c-1": "Gundam", "c-2": "Zaku", "u-1": "GM", "p-1": "Amuro Ray" })[id] ?? "uma carta";

describe("describeEvent — tradução GameEvent → linha PT", () => {
  const cases: Array<[GameEvent, string | null]> = [
    [{ type: "TURN_CHANGE", turnNumber: 3, activePlayer: "B" }, "— Turno 3 · Jogador B —"],
    [{ type: "PHASE_CHANGE", phase: "main" }, "Fase de Principal"],
    [{ type: "PHASE_CHANGE", phase: "start" }, null], // ruído
    [{ type: "DRAW_CARD", player: "A", from: "deck", instanceId: "c-1" }, "Jogador A comprou 1 carta"],
    [{ type: "DRAW_CARD", player: "A", from: "resourceDeck", instanceId: null }, "Jogador A pegou 1 recurso"],
    [{ type: "MOVE_CARD", instanceId: "c-1", toZone: "battleArea" }, "Gundam entrou na Battle Area"],
    [{ type: "MOVE_CARD", instanceId: "c-1", toZone: "trash" }, "Gundam foi pro trash"],
    [{ type: "PAIR_CARDS", pilotId: "p-1", unitId: "u-1" }, "Amuro Ray foi pareado com GM"],
    [{ type: "ATTACK_DECLARED", attackerId: "c-1", attackingPlayer: "A", defendingPlayer: "B", target: "player" }, "Gundam atacou Jogador B"],
    [{ type: "DAMAGE_SHIELD", player: "B", count: 2 }, "Jogador B perdeu 2 shields"],
    [{ type: "DESTROY_CARD", instanceId: "c-2" }, "Zaku foi destruída"],
    [{ type: "REMOVE_CARD_FROM_GAME", instanceId: "c-2" }, "Zaku foi removida do jogo"],
    [{ type: "GAME_OVER", winner: "A", reason: "deckOut" }, "FIM DE JOGO — vitória de Jogador A (deck vazio)"],
    // ruído puro de motor — nunca no feed
    [{ type: "COMBAT_STEP_CHANGE", step: "damage" }, null],
    [{ type: "ACTION_PASS", player: "A" }, null],
    [{ type: "CLEAR_PENDING_DECISION", player: "A" }, null],
  ];

  it.each(cases)("%o → %j", (event, expected) => {
    const entry = describeEvent(event, 0, nameOf);
    expect(entry?.text ?? null).toBe(expected);
  });

  it("nunca produz texto com 'undefined' e sempre carrega um kind válido", () => {
    for (const [event] of cases) {
      const entry = describeEvent(event, 0, nameOf);
      if (entry) {
        expect(entry.text).not.toMatch(/undefined/);
        expect(entry.kind).toBeTruthy();
      }
    }
  });
});

describe("buildBattleLog — sobre uma partida real", () => {
  it("exporta as linhas na ordem do eventLog, já sem os `null`", () => {
    const state = advanceToMainPhase(createGame(buildVanillaDeckList(), buildVanillaDeckList(), { seed: 9, firstPlayer: "A" }));
    const log = buildBattleLog(viewStateFor(state, "A"));

    expect(log.length).toBeGreaterThan(0);
    expect(log.every((e) => e.text.length > 0 && !e.text.includes("undefined"))).toBe(true);
    // o avanço até a Main Phase passa por Compra/Recurso/Main
    expect(log.some((e) => e.text === "Fase de Compra")).toBe(true);
    expect(log.some((e) => e.text === "Fase de Principal")).toBe(true);
  });
});
