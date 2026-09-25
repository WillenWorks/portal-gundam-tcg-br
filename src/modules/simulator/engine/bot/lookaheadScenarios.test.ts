import { describe, expect, it } from "vitest";
import { createGame } from "../setup";
import { advanceToMainPhase } from "../phases";
import { enumerateLegalActions, type LegalAction } from "../legalActions";
import { viewStateFor } from "../viewState";
import type { CardDef, CardInstance, GameState, PlayerId, Zone } from "../types";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver, validatedDeckList } from "../../content/index";
import { getCardDefByCode } from "../../content/allCardDefs";
import { heuristicPolicy } from "./heuristicPolicy";

/**
 * Cenários com CARTAS REAIS (spec bot-lookahead-efeitos, meta "Cobertura de
 * efeitos"): em cada um, jogar o efeito é claramente vantajoso e o bot `normal`
 * com lookahead tem que jogá-lo. O combate com efeito em aliado (ST05-013) está
 * em `server/botLookahead.test.ts` (bot real via `driveBotTurn`).
 */

const decks = validatedDeckList();
const deckBuild = (id: string) => decks.find((d) => d.id === id)!.build;
const resolvers = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const bot = () => heuristicPolicy({ level: "normal", lookahead: { specs: ALL_EFFECT_SPECS, ...resolvers } });
const rng = () => 0.42;

let seq = 0;
function put(state: GameState, player: PlayerId, zone: Zone, def: CardDef, extra: Partial<CardInstance> = {}): CardInstance {
  const card: CardInstance = {
    instanceId: `${player}-scn-${seq++}`,
    def,
    owner: player,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: state.turnNumber - 1,
    ...extra,
  };
  state.players[player][zone].push(card);
  return card;
}

function real(code: string): CardDef {
  const def = getCardDefByCode(code);
  if (!def) throw new Error(`carta ${code} fora do catálogo do simulador`);
  return def;
}

const RESOURCE: CardDef = { code: "SCN-RES", nameEn: "Res", cardType: "RESOURCE", color: "blue" };
const unit = (code: string, ap: number, hp: number, extra: Partial<CardDef> = {}): CardDef => ({
  code,
  nameEn: code,
  cardType: "UNIT",
  color: "blue",
  level: 1,
  cost: 1,
  ap,
  hp,
  ...extra,
});

function board(resources: number): GameState {
  const state = advanceToMainPhase(createGame(deckBuild("ST01")(), deckBuild("ST02")(), { seed: 31, firstPlayer: "A" }));
  for (const id of ["A", "B"] as const) {
    state.players[id].hand = [];
    state.players[id].battleArea = [];
    state.players[id].baseSection = [];
    state.players[id].resourceArea = [];
  }
  for (let i = 0; i < resources; i++) put(state, "A", "resourceArea", RESOURCE);
  return state;
}

function choose(state: GameState): LegalAction {
  const legal = enumerateLegalActions(state, "A", ALL_EFFECT_SPECS, resolvers);
  return bot()(viewStateFor(state, "A"), legal, rng);
}

describe("lookahead — cenários com cartas reais (bot normal)", () => {
  it("compra: GD01-100 'Draw 2' sem jogada melhor → joga", () => {
    const state = board(4);
    const cmd = put(state, "A", "hand", real("GD01-100"));
    expect(choose(state)).toMatchObject({ kind: "playCommand", cardInstanceId: cmd.instanceId });
  });

  it("token: ST04-012 Striker Pack (deploy de token) → joga", () => {
    const state = board(4);
    const cmd = put(state, "A", "hand", real("ST04-012"));
    expect(choose(state)).toMatchObject({ kind: "playCommand", cardInstanceId: cmd.instanceId });
  });

  it("cura (habilidade 【Activate·Main】): GD01-124 recupera HP de Unit amiga danificada → ativa", () => {
    const state = board(0);
    const base = put(state, "A", "baseSection", real("GD01-124"));
    put(state, "A", "battleArea", unit("SCN-HURT", 2, 4), { damage: 2, rested: true });
    expect(choose(state)).toMatchObject({ kind: "activateAbility", sourceInstanceId: base.instanceId });
  });

  it("bounce: ST04-013 devolve a ameaça inimiga pra mão → joga", () => {
    const state = board(2);
    const cmd = put(state, "A", "hand", real("ST04-013"));
    const threat = put(state, "B", "battleArea", unit("SCN-THREAT", 5, 3));
    expect(choose(state)).toMatchObject({ kind: "playCommand", cardInstanceId: cmd.instanceId, targets: { target: [threat.instanceId] } });
  });

  it("momento: ST05-013 (pump + 1 de dano em aliado) na Main sem atacante disponível → não joga", () => {
    const state = board(2);
    put(state, "A", "hand", real("ST05-013"));
    put(state, "A", "battleArea", unit("SCN-TIRED", 3, 3), { rested: true });
    expect(choose(state).kind).not.toBe("playCommand");
  });

  it("custo de oportunidade: com recurso pra só uma jogada, prefere deployar a Unit forte a comprar", () => {
    const state = board(4);
    put(state, "A", "hand", real("GD01-100")); // custo 3
    const strong = put(state, "A", "hand", unit("SCN-STRONG", 5, 5, { cost: 3, level: 1 }));
    expect(choose(state)).toMatchObject({ kind: "deployCard", cardInstanceId: strong.instanceId });
  });
});

describe("lookahead — desempenho em decisões reais", () => {
  it("p95 do tempo de decisão com Comando/habilidade candidato ≤ 300ms (self-play ST01×ST05, ST04×ST02)", async () => {
    const { runSelfPlay } = await import("../selfPlay");
    const durations: number[] = [];
    const policy = bot();
    const timed: typeof policy = (view, legal, r) => {
      const hasEffect = legal.some((a) => a.kind === "playCommand" || a.kind === "activateAbility");
      const t0 = performance.now();
      const out = policy(view, legal, r);
      if (hasEffect) durations.push(performance.now() - t0);
      return out;
    };
    for (const [a, b] of [["ST01", "ST05"], ["ST04", "ST02"]] as const) {
      for (let g = 0; g < 3; g++) {
        const result = runSelfPlay({
          deckA: deckBuild(a)(),
          deckB: deckBuild(b)(),
          seed: 500 + g,
          maxTurns: 30,
          policyA: timed,
          policyB: heuristicPolicy({ level: "normal" }),
          specs: ALL_EFFECT_SPECS,
          ...resolvers,
        });
        expect(result.crashed, `crash: ${result.crashed?.error}`).toBeUndefined();
        expect(result.illegalState, `estado ilegal: ${result.illegalState}`).toBeUndefined();
      }
    }
    expect(durations.length).toBeGreaterThan(10);
    const sorted = [...durations].sort((x, y) => x - y);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    console.log(`[lookahead-perf] ${durations.length} decisões com efeito | p50 ${sorted[Math.floor(sorted.length / 2)].toFixed(1)}ms | p95 ${p95.toFixed(1)}ms`);
    expect(p95).toBeLessThanOrEqual(300);
  }, 180_000);
});
