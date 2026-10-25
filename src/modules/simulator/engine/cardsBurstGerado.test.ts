/* Camada 1 da fase de assertividade, categoria 【Burst】: um caso a favor e um contra para CADA carta com spec
 * de Burst, gerados a partir de ALL_EFFECT_SPECS e jogados pelo caminho do jogador — ataque direto, shield
 * quebrada, decisão oferecida ao defensor, ativar ou recusar. Testes que chamam o spec direto passam mesmo com
 * a habilidade nunca oferecida no jogo; aqui a oferta faz parte do teste. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { actionOwner, enumerateLegalActions } from "./legalActions";
import { placeCard } from "./__testkit__/cardHarness";
import type { CardDef, CardInstance, GameState, PlayerId } from "./types";
import type { EffectSpec } from "./effectSpec";
import { fingerprint, richBoard, settleDecisions, trashMaterialFor } from "./__testkit__/cardScenario";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const opts = { predicateResolver: defaultPredicateResolver, targetFilterResolver: defaultTargetFilterResolver };
const apply = (s: GameState, p: PlayerId, a: PlayerAction) =>
  applyPlayerAction(s, p, a, ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver);

const BURST_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger === "Burst");
const BURST_CARDS = [...new Set(BURST_SPECS.map((s) => s.cardCode))].sort().filter((code) => ALL_CARD_DEFS[code]);

const TRASH_MATERIAL = trashMaterialFor(BURST_SPECS);

/** A ataca B direto com a shield do topo trocada por `def`; joga passes até a decisão de 【Burst】 (tabuleiro: `richBoard`) */
function breakShieldWith(def: CardDef, extra?: (state: GameState) => void): { state: GameState; shieldId: string } {
  const state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  state.players.B.baseSection = [];
  richBoard(state, "B", TRASH_MATERIAL);
  extra?.(state);
  const attackerId = placeCard(state, "A", ST01_CARD_DEFS.GUNDAM, "battleArea");
  const shield = state.players.B.shields[0];
  state.players.B.shields[0] = { ...shield, def } as CardInstance;

  let next = apply(state, "A", { kind: "declareAttack", attackerId, target: "player" });
  for (let guard = 0; guard < 20 && next.pendingDecision.B?.kind !== "burst"; guard++) {
    const seat = actionOwner(next);
    if (!seat) break;
    const legal = enumerateLegalActions(next, seat, ALL_EFFECT_SPECS, opts);
    const pass = legal.find((a) => a.kind === "skipBlock" || a.kind === "passAction");
    if (!pass) break;
    next = apply(next, seat, pass);
  }
  return { state: next, shieldId: shield.instanceId };
}

const settleDefender = (state: GameState) => settleDecisions(state, ALL_EFFECT_SPECS);

const zoneOf = (state: GameState, id: string) =>
  (["hand", "battleArea", "baseSection", "trash", "deck", "shields", "exile"] as const).find((z) => state.players.B[z].some((c) => c.instanceId === id));

function expectedOnActivate(specs: EffectSpec[]): "hand" | "deployed" | "changed" {
  const first = specs[0]?.actions?.[0] as { op?: string; toZone?: string; target?: { kind?: string } } | undefined;
  if (first?.op === "moveZone" && first.toZone === "hand" && first.target?.kind === "self") return "hand";
  if (first?.op === "deployThisCard") return "deployed";
  return "changed";
}

/* Bursts que, neste tabuleiro, não deixam rastro visível no fingerprint (efeito condicional sem a condição,
 * proteção que só vale num evento futuro, …). A lista é cobrada: entrar ou sair dela é decisão consciente. */
const SEM_RASTRO_NO_TABULEIRO: string[] = [];

describe(`【Burst】 gerado — ${BURST_CARDS.length} cartas, caminho do jogador`, () => {
  it("toda carta com 【Burst】 é oferecida ao defensor quando a shield quebra (com a carta à vista)", () => {
    const naoOferecidas: string[] = [];
    for (const code of BURST_CARDS) {
      const { state, shieldId } = breakShieldWith(ALL_CARD_DEFS[code]);
      const d = state.pendingDecision.B;
      if (d?.kind !== "burst" || d.cardInstanceId !== shieldId || d.cardDef.code !== code) naoOferecidas.push(code);
    }
    expect(naoOferecidas).toEqual([]);
  }, 120_000);

  it("a favor: ativar faz o que o texto diz (vai para a mão / entra em jogo / muda o tabuleiro)", () => {
    const falhas: string[] = [];
    const semRastro: string[] = [];
    for (const code of BURST_CARDS) {
      const specs = BURST_SPECS.filter((s) => s.cardCode === code);
      const { state, shieldId } = breakShieldWith(ALL_CARD_DEFS[code]);
      if (state.pendingDecision.B?.kind !== "burst") continue; // o teste de oferta já acusa
      // ativar como o jogador ativa: pela jogada que o motor oferece (com os alvos, quando o Burst pede)
      const activate = enumerateLegalActions(state, "B", ALL_EFFECT_SPECS, opts).find((a) => a.kind === "resolveBurstDecision" && a.activate);
      if (!activate) {
        falhas.push(`${code}: ativar não está entre as jogadas legais`);
        continue;
      }
      let declined: GameState;
      let activated: GameState;
      try {
        declined = settleDefender(apply(state, "B", { kind: "resolveBurstDecision", activate: false }));
        activated = settleDefender(apply(state, "B", activate));
      } catch (err) {
        falhas.push(`${code}: exceção ${(err as Error).message}`);
        continue;
      }
      const where = zoneOf(activated, shieldId);
      switch (expectedOnActivate(specs)) {
        case "hand":
          if (where !== "hand") falhas.push(`${code}: devia ir para a mão, foi para ${where}`);
          break;
        case "deployed":
          if (where !== "baseSection" && where !== "battleArea") falhas.push(`${code}: devia entrar em jogo, foi para ${where}`);
          break;
        case "changed":
          if (fingerprint(activated) === fingerprint(declined)) semRastro.push(code);
          break;
      }
    }
    expect(falhas).toEqual([]);
    expect([...semRastro].sort()).toEqual([...SEM_RASTRO_NO_TABULEIRO].sort());
  }, 120_000);

  it("contra: recusar manda a carta para a lixeira e não aplica o efeito", () => {
    const falhas: string[] = [];
    for (const code of BURST_CARDS) {
      const { state, shieldId } = breakShieldWith(ALL_CARD_DEFS[code]);
      if (state.pendingDecision.B?.kind !== "burst") continue;
      const handBefore = state.players.B.hand.length;
      const declined = apply(state, "B", { kind: "resolveBurstDecision", activate: false });
      if (zoneOf(declined, shieldId) !== "trash") falhas.push(`${code}: recusado foi para ${zoneOf(declined, shieldId)}`);
      if (declined.players.B.hand.length !== handBefore) falhas.push(`${code}: recusado mexeu na mão`);
      if (declined.pendingDecision.B?.kind === "abilityResolution") falhas.push(`${code}: recusado abriu decisão de efeito`);
    }
    expect(falhas).toEqual([]);
  }, 120_000);
});

describe("achados da camada 1 de 【Burst】", () => {
  it("GD01-121 Midair Modifications: só Unit descansada com <Blocker>, de qualquer lado (o spec aceitava qualquer Unit amiga)", () => {
    const ids: Record<string, string> = {};
    const { state } = breakShieldWith(ALL_CARD_DEFS["GD01-121"], (s) => {
      ids.ownRestedBlocker = placeCard(s, "B", ST01_CARD_DEFS.ZOWORT, "battleArea", { rested: true });
      ids.ownActiveBlocker = placeCard(s, "B", ST01_CARD_DEFS.ZOWORT, "battleArea");
      ids.enemyRestedBlocker = placeCard(s, "A", ST01_CARD_DEFS.DEMI_TRAINER, "battleArea", { rested: true });
    });
    const targets = enumerateLegalActions(state, "B", ALL_EFFECT_SPECS, opts).flatMap((a) =>
      a.kind === "resolveBurstDecision" && a.activate ? (a.targets?.target ?? []) : [],
    );
    expect(targets).toEqual(expect.arrayContaining([ids.ownRestedBlocker, ids.enemyRestedBlocker]));
    expect(targets).not.toContain(ids.ownActiveBlocker);
    const units = [...state.players.A.battleArea, ...state.players.B.battleArea];
    for (const id of targets) {
      const unit = units.find((u) => u.instanceId === id);
      expect(unit?.rested && unit.def.effectKeywords?.includes("Blocker")).toBe(true);
    }
  });
});
