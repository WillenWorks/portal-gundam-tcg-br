import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import type { GameState, PlayerId } from "./types";
import { PLAYER_IDS } from "./types";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { actionOwner, enumerateLegalActions } from "./legalActions";
import { legalMenuFor } from "./legalMenu";
import { eventsSinceFor, MAX_EVENTS_SINCE, viewStateFor } from "./viewState";
import { createRng } from "./rng";
import { applyEvent } from "./events";
import { DECK_BUILDERS, GOLDEN_PAIRS } from "./__golden__/harness";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { decisionVisibilityGaps, findViewLeaks } from "./viewLeaks";

const opts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const apply = (s: GameState, p: PlayerId, a: PlayerAction) =>
  applyPlayerAction(s, p, a, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);

/** todo estado de partidas aleatórias dos pares do golden, inclusive com decisão pendente */
function* allStates(maxSteps: number): Generator<{ key: string; step: number; state: GameState }> {
  for (const pair of GOLDEN_PAIRS) {
    let state = createGame(DECK_BUILDERS[pair.a](), DECK_BUILDERS[pair.b](), { seed: pair.seed, firstPlayer: "A", interactiveMulligan: true });
    const rng = createRng(pair.seed * 104_729);
    for (let step = 0; step < maxSteps && !state.gameOver; step++) {
      yield { key: pair.key, step, state };
      const seat = actionOwner(state);
      if (!seat) break;
      const legal = enumerateLegalActions(state, seat, ALL_EFFECT_SPECS, opts);
      if (legal.length === 0) break;
      state = apply(state, seat, legal[Math.floor(rng() * legal.length)]);
    }
  }
}

describe("visão de cada jogador — informação oculta", () => {
  it("nenhuma carta oculta chega identificada ao jogador (zonas, decisão, log, menu) — todos os pares do golden", () => {
    const leaks: string[] = [];
    let views = 0;
    for (const { key, step, state } of allStates(200)) {
      for (const viewer of PLAYER_IDS) {
        views++;
        const payload = {
          view: viewStateFor(state, viewer),
          legalMenu: legalMenuFor(state, viewer, ALL_EFFECT_SPECS, opts),
          // a transmissão leva os eventos desde a anterior (spec simulador-animacao-pelo-log)
          eventsSince: eventsSinceFor(state, Math.max(0, state.eventLog.length - 60), viewer),
        };
        for (const leak of findViewLeaks(state, viewer, payload)) leaks.push(`${key}#${step} ${viewer} ${leak.path} (${leak.instanceId})`);
      }
    }
    expect(views).toBeGreaterThan(8000);
    expect(leaks.slice(0, 10)).toEqual([]);
  }, 180_000);

  it("a decisão traz o que o jogador precisa ver para decidir", () => {
    const gaps: string[] = [];
    let decisions = 0;
    for (const { key, step, state } of allStates(200)) {
      for (const viewer of PLAYER_IDS) {
        if (!state.pendingDecision[viewer]) continue;
        decisions++;
        for (const gap of decisionVisibilityGaps(state, viewStateFor(state, viewer))) gaps.push(`${key}#${step} ${viewer} ${gap}`);
      }
    }
    expect(decisions).toBeGreaterThan(50);
    expect(gaps.slice(0, 10)).toEqual([]);
  }, 180_000);
});

describe("instanceId não revela a carta oculta", () => {
  const seq = (id: string) => Number(id.slice(id.lastIndexOf("-") + 1));
  const increasing = (ns: number[]) => ns.every((n, i) => i === 0 || n > ns[i - 1]);
  /** shields e deck em ordem crescente de id, e tudo o que já saiu do topo tem id menor que o deck: o id é só a posição */
  const dealtInOrder = (state: GameState, p: PlayerId) => {
    const { hand, shields, deck } = state.players[p];
    const dealt = [...hand, ...shields].map((c) => seq(c.instanceId));
    const deckIds = deck.map((c) => seq(c.instanceId));
    return increasing(shields.map((c) => seq(c.instanceId))) && increasing(deckIds) && Math.max(...dealt) < Math.min(...deckIds);
  };
  const deckAgrupado = () => DECK_BUILDERS[GOLDEN_PAIRS[0].a]();

  it("a lista do deck vem agrupada, mas os ids seguem a ordem embaralhada", () => {
    const list = deckAgrupado();
    expect(list.main[0].code).toBe(list.main[1].code); // o vazamento só existe porque a lista é agrupada
    for (const mulligan of [false, true]) {
      const state = createGame(list, deckAgrupado(), { seed: 11, firstPlayer: "A", mulligan: { A: mulligan, B: mulligan } });
      for (const p of PLAYER_IDS) expect(dealtInOrder(state, p)).toBe(true);
      const resourceIds = state.players.A.resourceDeck.map((c) => seq(c.instanceId));
      expect(resourceIds).toEqual([...resourceIds].sort((a, b) => a - b));
    }
  });

  it("mulligan interativo: a mão devolvida não deixa rastro de posição no deck nem nas shields", () => {
    let state = createGame(deckAgrupado(), deckAgrupado(), { seed: 5, firstPlayer: "A", interactiveMulligan: true });
    const devolvidas = new Set(state.players.A.hand.map((c) => c.instanceId));
    state = apply(state, "A", { kind: "resolveMulligan", keep: false });
    state = apply(state, "B", { kind: "resolveMulligan", keep: true });
    expect(dealtInOrder(state, "A")).toBe(true);
    // os ids da mão devolvida voltam a ser só as 5 primeiras posições — estão na mão nova
    const mao = new Set(state.players.A.hand.map((c) => c.instanceId));
    expect([...devolvidas].every((id) => mao.has(id))).toBe(true);
  });

  it("devolver a lixeira ao deck e embaralhar (GD01-003) redistribui os ids", () => {
    const state = createGame(deckAgrupado(), deckAgrupado(), { seed: 3, firstPlayer: "A" });
    const p = state.players.A;
    const voltam = p.deck.splice(0, 12).map((c) => ({ ...c, zone: "trash" as const }));
    p.trash.push(...voltam);
    const next = applyEvent(state, { type: "RETURN_TRASH_TO_DECK_SHUFFLE", player: "A", instanceIds: voltam.map((c) => c.instanceId) });
    const ids = next.players.A.deck.map((c) => seq(c.instanceId));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});

describe("eventsSinceFor — eventos para a tela animar", () => {
  const state = createGame(DECK_BUILDERS[GOLDEN_PAIRS[0].a](), DECK_BUILDERS[GOLDEN_PAIRS[0].b](), { seed: 2, firstPlayer: "A" });
  const len = state.eventLog.length;

  it("sem sequência para continuar (desconhecida, de outro jogo, lote grande demais): não manda eventos", () => {
    expect(eventsSinceFor(state, undefined, "A")).toBeUndefined();
    expect(eventsSinceFor(state, len + 1, "A")).toBeUndefined();
    const longo = { ...state, eventLog: Array.from({ length: MAX_EVENTS_SINCE + 1 }, () => ({ type: "COMBAT_ENDED" as const })) };
    expect(eventsSinceFor(longo, 0, "A")).toBeUndefined();
  });

  it("devolve exatamente os eventos depois de `from`", () => {
    expect(eventsSinceFor(state, len, "A")).toEqual([]);
    expect(eventsSinceFor(state, Math.max(0, len - 3), "B")).toHaveLength(Math.min(3, len));
  });
});
