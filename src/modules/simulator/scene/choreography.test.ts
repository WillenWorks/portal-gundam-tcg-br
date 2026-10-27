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
    expect(kinds(beats)).toEqual(["play", "announce", "effects"]);
    expect(beats[1]).toEqual({ kind: "announce", player: "B", instanceId: "u1", trigger: "Deploy", paid: [] });
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

  it("efeitos-na-mesa: o tempo de efeito leva a carta que o causou (a linha neon sai dela)", () => {
    const { beats } = plan([
      { type: "CARD_PLAYED", player: "B", instanceId: "kayra", as: "unit" },
      { type: "ABILITY_ACTIVATED", player: "B", instanceId: "kayra", trigger: "Deploy" },
      { type: "GRANT_ATTACK_TARGET_RELAX", instanceId: "murasame", maxAp: 4, turn: 8 },
    ]);
    expect(kinds(beats)).toEqual(["play", "announce", "effects"]);
    expect(beats[2]).toEqual({
      kind: "effects",
      events: [{ type: "GRANT_ATTACK_TARGET_RELAX", instanceId: "murasame", maxAp: 4, turn: 8 }],
      source: { instanceId: "kayra", player: "B" },
    });
    // a Command em uso também é fonte
    const cmd = plan([
      { type: "CARD_PLAYED", player: "A", instanceId: "c1", as: "command", trigger: "Main" },
      { type: "MODIFY_STAT", instanceId: "u1", modifier: { stat: "ap", amount: 2, duration: "endOfTurn", appliedOnTurn: 1 } } as GameEvent,
    ]).beats;
    expect(cmd[1]).toMatchObject({ kind: "effects", source: { instanceId: "c1", player: "A" } });
  });

  it("P3: a minha jogada também tem o tempo dela (igual à do oponente), com o custo pago junto", () => {
    const deploy: GameEvent = { type: "CARD_PLAYED", player: "A", instanceId: "u1", as: "unit" };
    const paid: GameEvent[] = [
      { type: "REST_CARD", instanceId: "r1" },
      { type: "REST_CARD", instanceId: "r2" },
    ];
    const { beats } = plan([deploy, ...paid, { type: "MOVE_CARD", instanceId: "u1", toZone: "battleArea" }], "A", "main", null, new Set(["r1", "r2"]));
    expect(beats).toEqual([{ kind: "play", player: "A", instanceId: "u1", as: "unit", paid: ["r1", "r2"] }]);
    // o oponente vê o mesmo tempo
    expect(plan([deploy, ...paid], "B", "main", null, new Set(["r1", "r2"])).beats).toEqual(beats);
    expect(kinds(plan([deploy, { type: "ABILITY_ACTIVATED", player: "A", instanceId: "u1", trigger: "Deploy" }]).beats)).toEqual(["play", "announce"]);
    expect(hasOwnDeploy([deploy], "A")).toBe(true);
    expect(hasOwnDeploy([deploy], "B")).toBe(false);
  });

  it("Command: o mesmo tempo para os dois lados; os efeitos vêm em seguida e ela vai à lixeira sem voo", () => {
    const cmd = (player: PlayerId): GameEvent[] => [
      { type: "CARD_PLAYED", player, instanceId: "c1", as: "command", trigger: "Main" },
      { type: "HEAL_UNIT", instanceId: "u1", amount: 2 } as GameEvent,
      { type: "MOVE_CARD", instanceId: "c1", toZone: "trash" },
    ];
    expect(kinds(plan(cmd("B")).beats)).toEqual(["play", "effects"]);
    expect(kinds(plan(cmd("A")).beats)).toEqual(["play", "effects"]);
  });

  it("【Activate】: o custo pago vai com o anúncio; recurso deitado/levantado por efeito vira tempo (gira na mesa)", () => {
    const resources = new Set(["r1", "r2"]);
    const { beats } = plan(
      [
        { type: "ABILITY_ACTIVATED", player: "A", instanceId: "u1", trigger: "Activate·Main" },
        { type: "REST_CARD", instanceId: "r1" },
        { type: "SET_ACTIVE", instanceId: "r2" },
      ],
      "B",
      "main",
      null,
      resources,
    );
    expect(beats[0]).toEqual({ kind: "announce", player: "A", instanceId: "u1", trigger: "Activate·Main", paid: ["r1"] });
    expect(beats[1]).toEqual({ kind: "effects", events: [{ type: "SET_ACTIVE", instanceId: "r2" }], source: { instanceId: "u1", player: "A" } });
  });

  it("P5: carta indo para a mão fora da compra (【Burst】 à mão, Unit que volta) tem o tempo dela", () => {
    const { beats } = plan([
      { type: "ABILITY_ACTIVATED", player: "B", instanceId: "s1", trigger: "Burst" },
      { type: "MOVE_CARD", instanceId: "s1", toZone: "hand" },
    ]);
    expect(kinds(beats)).toEqual(["announce", "toHand"]);
    expect(beats[1]).toEqual({ kind: "toHand", instanceId: "s1" });
  });

  it("【Burst】: o do oponente é anunciado; o meu já teve revelação e modal", () => {
    const burst = (player: PlayerId): GameEvent => ({ type: "ABILITY_ACTIVATED", player, instanceId: "s1", trigger: "Burst" });
    expect(kinds(plan([burst("B")]).beats)).toEqual(["announce"]);
    expect(plan([burst("A")]).beats).toEqual([]);
  });

  it("combate (P4, na ordem do motor): declarar → 【Attack】 → bloquear → golpe → dano → a destruída quebra", () => {
    const { beats, pendingAttack } = plan([
      // o motor deita o atacante ANTES de declarar, e o bloqueador ANTES de bloquear
      { type: "REST_CARD", instanceId: "b1" },
      attack("b1"),
      { type: "ABILITY_ACTIVATED", player: "B", instanceId: "b1", trigger: "Attack" },
      { type: "MODIFY_STAT", instanceId: "b1", modifier: { stat: "ap", amount: 1, duration: "thisBattle", appliedOnTurn: 1 } } as GameEvent,
      { type: "COMBAT_STEP_CHANGE", step: "block" } as GameEvent,
      { type: "REST_CARD", instanceId: "a1" },
      { type: "BLOCK_DECLARED", blockerId: "a1", newTarget: { unitId: "a1" } } as GameEvent,
      { type: "DAMAGE_UNIT", instanceId: "a1", amount: 4 } as GameEvent,
      { type: "DESTROY_CARD", instanceId: "a1" } as GameEvent,
      { type: "COMBAT_ENDED" },
    ]);
    expect(kinds(beats)).toEqual(["declare", "announce", "effects", "block", "strike", "effects", "departure"]);
    expect(beats[0]).toMatchObject({ kind: "declare", attackerId: "b1", target: "player", rests: true });
    expect(beats[3]).toMatchObject({ kind: "block", blockerId: "a1", rests: true });
    expect(beats[4]).toMatchObject({ kind: "strike", attackerId: "b1", target: { unitId: "a1" } });
    expect(beats[6]).toMatchObject({ kind: "departure", ids: ["a1"], destroyed: true });
    // o descanso do atacante/bloqueador não vira efeito solto
    expect(beats.some((b) => b.kind === "effects" && b.events.some((e) => e.type === "REST_CARD"))).toBe(false);
    expect(pendingAttack).toBeNull();
  });

  it("dano de shield com 【Burst】 meu pendente: o golpe toca neste lote, antes da shield, e não toca de novo", () => {
    const first = plan([attack("b1"), { type: "DAMAGE_SHIELD", player: "A", count: 1 }, { type: "SET_PENDING_DECISION", player: "A" } as GameEvent]);
    expect(kinds(first.beats)).toEqual(["declare", "strike", "effects", "departure"]);
    expect(first.pendingAttack).toBeNull();
    expect(kinds(plan([{ type: "COMBAT_ENDED" }], "A", "main", first.pendingAttack).beats)).toEqual([]);
  });

  it("à espera do bloqueio, o combate fica pendente e o golpe sai quando ele terminar", () => {
    const first = plan([{ type: "REST_CARD", instanceId: "b1" }, attack("b1")]);
    expect(kinds(first.beats)).toEqual(["declare"]);
    expect(first.pendingAttack).toMatchObject({ attackerId: "b1" });
    expect(kinds(plan([{ type: "COMBAT_ENDED" }], "A", "main", first.pendingAttack).beats)).toEqual(["strike"]);
  });

  it("estrutura do turno (ativar tudo no Start) não vira cue; o recurso pago vai com a carta", () => {
    expect(plan([{ type: "SET_ACTIVE", instanceId: "u1" }], "A", "start").beats).toEqual([]);
    expect(
      kinds(plan([{ type: "CARD_PLAYED", player: "A", instanceId: "u1", as: "unit" }, { type: "REST_CARD", instanceId: "r1" }], "A", "main", null, new Set(["r1"])).beats),
    ).toEqual(["play"]);
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
