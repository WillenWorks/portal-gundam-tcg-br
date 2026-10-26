import { describe, expect, it } from "vitest";
import { LONG_BATCH_BEATS, LONG_BATCH_TEMPO, hasOwnDeploy, planChoreography, tempoFor, triggerLabel, type Beat, type PendingAttack } from "./choreography";
import type { GameEvent, GameState, Phase, PlayerId } from "../engine/types";
import { PLAYER_IDS } from "../engine/types";
import { createGame } from "../engine/setup";
import { applyPlayerAction } from "../engine/actions";
import { actionOwner, enumerateLegalActions } from "../engine/legalActions";
import { eventsSinceFor } from "../engine/viewState";
import { createRng } from "../engine/rng";
import { DECK_BUILDERS, GOLDEN_PAIRS } from "../engine/__golden__/harness";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";

const opts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const plan = (events: GameEvent[], viewerSeat: PlayerId = "A", phase: Phase = "main", pendingAttack: PendingAttack | null = null, resourceIds?: Set<string>) =>
  planChoreography({ events, viewerSeat, pendingAttack, phase, resourceIds });
const kinds = (beats: Beat[]) => beats.map((b) => b.kind);
const attack = (attackerId: string, defendingPlayer: PlayerId = "A"): GameEvent => ({
  type: "ATTACK_DECLARED",
  attackerId,
  attackingPlayer: defendingPlayer === "B" ? "A" : "B",
  defendingPlayer,
  target: "player",
});

describe("planChoreography — uma coisa de cada vez, na ordem do motor", () => {
  it("Unit do bot com 【Deploy】: a carta entra, o efeito é anunciado e só então o que ele fez aparece", () => {
    const { beats } = plan([
      { type: "CARD_PLAYED", player: "B", instanceId: "u1", as: "unit" },
      { type: "DEPLOY_AS_UNIT", instanceId: "u1" } as GameEvent,
      { type: "ABILITY_ACTIVATED", player: "B", instanceId: "u1", trigger: "Deploy" },
      { type: "DAMAGE_UNIT", instanceId: "a1", amount: 2 } as GameEvent,
      { type: "DAMAGE_UNIT", instanceId: "a2", amount: 2 } as GameEvent,
    ]);
    expect(kinds(beats)).toEqual(["deploy", "announce", "effects"]);
    expect(beats[1]).toEqual({ kind: "announce", player: "B", instanceId: "u1", trigger: "Deploy" });
    // o mesmo efeito em dois alvos aparece junto (um tempo só)
    expect(beats[2].kind === "effects" && beats[2].events).toHaveLength(2);
  });

  it("compra por efeito vira o mesmo saque da Draw Phase; a da Draw Phase fica com a virada de turno", () => {
    const draw: GameEvent = { type: "DRAW_CARD", player: "A", from: "deck", instanceId: "c1" } as GameEvent;
    expect(kinds(plan([{ type: "ABILITY_ACTIVATED", player: "A", instanceId: "u1", trigger: "Deploy" }, draw]).beats)).toEqual(["announce", "draw"]);
    expect(plan([{ type: "PHASE_CHANGE", phase: "draw" } as GameEvent, draw], "A", "start").beats).toEqual([]);
  });

  it("dois efeitos seguidos: cada um com seu anúncio e seu tempo", () => {
    const { beats } = plan([
      { type: "ABILITY_ACTIVATED", player: "B", instanceId: "u1", trigger: "Deploy" },
      { type: "MODIFY_STAT", instanceId: "u1", modifier: { stat: "ap", amount: 2, duration: "endOfTurn", appliedOnTurn: 1 } } as GameEvent,
      { type: "ABILITY_ACTIVATED", player: "B", instanceId: "u2", trigger: "When Paired" },
      { type: "REST_CARD", instanceId: "a1" },
    ]);
    expect(kinds(beats)).toEqual(["announce", "effects", "announce", "effects"]);
  });

  it("minha jogada sozinha não segura a fila; seguida de efeito, entra antes dele", () => {
    const deploy: GameEvent = { type: "CARD_PLAYED", player: "A", instanceId: "u1", as: "unit" };
    expect(plan([deploy, { type: "DEPLOY_AS_UNIT", instanceId: "u1" } as GameEvent]).beats).toEqual([]);
    expect(kinds(plan([deploy, { type: "ABILITY_ACTIVATED", player: "A", instanceId: "u1", trigger: "Deploy" }]).beats)).toEqual(["deploy", "announce"]);
    expect(hasOwnDeploy([deploy], "A")).toBe(true);
    expect(hasOwnDeploy([deploy], "B")).toBe(false);
  });

  it("Command: a do oponente tem o lançamento (a minha tocou antes do envio); os efeitos dela vêm em seguida", () => {
    const cmd = (player: PlayerId): GameEvent[] => [
      { type: "CARD_PLAYED", player, instanceId: "c1", as: "command", trigger: "Main" },
      { type: "HEAL_UNIT", instanceId: "u1", amount: 2 } as GameEvent,
    ];
    expect(kinds(plan(cmd("B")).beats)).toEqual(["opponentCommand", "effects"]);
    expect(kinds(plan(cmd("A")).beats)).toEqual(["effects"]);
  });

  it("【Burst】: o do oponente é anunciado; o meu já teve revelação e modal", () => {
    const burst = (player: PlayerId): GameEvent => ({ type: "ABILITY_ACTIVATED", player, instanceId: "s1", trigger: "Burst" });
    expect(kinds(plan([burst("B")]).beats)).toEqual(["announce"]);
    expect(plan([burst("A")]).beats).toEqual([]);
  });

  it("combate: o 【Attack】 resolve na hora; o dano e a Unit destruída vêm depois do golpe", () => {
    const { beats, pendingAttack } = plan([
      attack("b1"),
      { type: "REST_CARD", instanceId: "b1" },
      { type: "ABILITY_ACTIVATED", player: "B", instanceId: "b1", trigger: "Attack" },
      { type: "MODIFY_STAT", instanceId: "b1", modifier: { stat: "ap", amount: 1, duration: "thisBattle", appliedOnTurn: 1 } } as GameEvent,
      { type: "COMBAT_STEP_CHANGE", step: "block" } as GameEvent,
      { type: "BLOCK_DECLARED", blockerId: "a1", newTarget: { unitId: "a1" } } as GameEvent,
      { type: "DAMAGE_UNIT", instanceId: "a1", amount: 4 } as GameEvent,
      { type: "DESTROY_CARD", instanceId: "a1" } as GameEvent,
      { type: "COMBAT_ENDED" },
    ]);
    expect(kinds(beats)).toEqual(["announce", "effects", "effects", "strike", "effects", "departure"]);
    expect(beats[3]).toMatchObject({ kind: "strike", attackerId: "b1", target: { unitId: "a1" } });
    expect(pendingAttack).toBeNull();
  });

  it("dano de shield com 【Burst】 meu pendente: o golpe toca neste lote, antes da shield, e não toca de novo", () => {
    const first = plan([attack("b1"), { type: "DAMAGE_SHIELD", player: "A", count: 1 }, { type: "SET_PENDING_DECISION", player: "A" } as GameEvent]);
    expect(kinds(first.beats)).toEqual(["strike", "effects", "departure"]);
    expect(first.pendingAttack).toBeNull();
    expect(kinds(plan([{ type: "COMBAT_ENDED" }], "A", "main", first.pendingAttack).beats)).toEqual([]);
  });

  it("à espera do bloqueio, o combate fica pendente e o golpe sai quando ele terminar", () => {
    const first = plan([attack("b1"), { type: "REST_CARD", instanceId: "b1" }]);
    expect(first.beats).toEqual([]);
    expect(first.pendingAttack).toMatchObject({ attackerId: "b1" });
    expect(kinds(plan([{ type: "COMBAT_ENDED" }], "A", "main", first.pendingAttack).beats)).toEqual(["strike"]);
  });

  it("estrutura do turno (ativar tudo no Start, recurso pago) não vira cue", () => {
    expect(plan([{ type: "SET_ACTIVE", instanceId: "u1" }], "A", "start").beats).toEqual([]);
    expect(plan([{ type: "REST_CARD", instanceId: "r1" }], "A", "main", null, new Set(["r1"])).beats).toEqual([]);
    expect(kinds(plan([{ type: "REST_CARD", instanceId: "u9" }]).beats)).toEqual(["effects"]);
  });

  it("lote longo (turno inteiro do bot) encurta os tempos", () => {
    const beats: Beat[] = Array.from({ length: LONG_BATCH_BEATS + 1 }, () => ({ kind: "effects", events: [] }));
    expect(tempoFor(beats)).toBe(LONG_BATCH_TEMPO);
    expect(tempoFor(beats.slice(0, LONG_BATCH_BEATS))).toBe(1);
  });

  it("rótulo do gatilho como na carta; reações viram 'Efeito'", () => {
    expect(triggerLabel("Deploy").pt).toBe("【Deploy】");
    expect(triggerLabel("Activate·Main").en).toBe("【Activate･Main】");
    expect(triggerLabel("Reaction:destroyedEnemyInBattle")).toEqual({ pt: "Efeito", en: "Effect" });
  });
});

describe("planChoreography em partidas reais, com lotes de várias jogadas (como o turno do bot)", () => {
  it("todo combate vira 1 golpe, toda ativação 1 anúncio e toda compra por efeito 1 saque, com qualquer corte de lote", () => {
    const erros: string[] = [];
    let anuncios = 0;
    for (const pair of GOLDEN_PAIRS.slice(0, 16)) {
      let state: GameState = createGame(DECK_BUILDERS[pair.a](), DECK_BUILDERS[pair.b](), { seed: pair.seed, firstPlayer: "A", interactiveMulligan: true });
      const rng = createRng(pair.seed * 7_777);
      const cuts: number[] = [state.eventLog.length];
      const phases: Phase[] = [state.phase];
      for (let step = 0; step < 220 && !state.gameOver; step++) {
        const seat = actionOwner(state);
        if (!seat) break;
        const legal = enumerateLegalActions(state, seat, ALL_EFFECT_SPECS, opts);
        if (legal.length === 0) break;
        state = applyPlayerAction(state, seat, legal[Math.floor(rng() * legal.length)], ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);
        if (rng() < 0.3) {
          cuts.push(state.eventLog.length);
          phases.push(state.phase);
        }
      }
      cuts.push(state.eventLog.length);
      const log = state.eventLog;
      const combats = log.filter((e) => e.type === "COMBAT_ENDED").length;
      for (const viewer of PLAYER_IDS) {
        const beats: Beat[] = [];
        let pending: PendingAttack | null = null;
        for (let i = 1; i < cuts.length; i++) {
          const events = eventsSinceFor({ ...state, eventLog: log.slice(0, cuts[i]) }, cuts[i - 1], viewer) ?? [];
          const r = planChoreography({ events, viewerSeat: viewer, pendingAttack: pending, phase: phases[i - 1] });
          beats.push(...r.beats);
          pending = r.pendingAttack;
        }
        const activations = log.filter((e) => e.type === "ABILITY_ACTIVATED" && !(e.trigger === "Burst" && e.player === viewer)).length;
        const strikes = beats.filter((b) => b.kind === "strike").length;
        const announced = beats.filter((b) => b.kind === "announce").length;
        anuncios += announced;
        if (strikes !== combats || announced !== activations) erros.push(`${pair.key} ${viewer}: golpes ${strikes}/${combats}, anúncios ${announced}/${activations}`);
      }
    }
    expect(erros).toEqual([]);
    expect(anuncios).toBeGreaterThan(0);
  }, 120_000);
});
