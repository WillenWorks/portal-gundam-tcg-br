import type { CardDef, CardInstance, GameState, PlayerId, PlayerState, Zone } from "../types";
import { effectiveAp, effectiveHp, otherPlayer } from "../types";
import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "../effectSpec";
import type { LegalAction } from "../legalActions";
import type { Rng } from "../rng";
import { createRng } from "../rng";
import type { SelfPlayPolicy } from "../selfPlay";
import { randomLegal } from "../selfPlay";
import type { ViewCardInstance, ViewGameState } from "../viewState";
import { applyPlayerAction } from "../actions";
import { cloneState } from "../events";
import { chooseAction as heuristicChoose, heuristicPolicy } from "./heuristicPolicy";
import { simulateToEnd } from "./simulateToEnd";

/**
 * Bot MCTS raso — o nível "difícil" do produto (docs/44, Fase 5 — §7.2). O
 * `heuristicPolicy` cobre `facil`/`normal`; este é o `dificil`.
 *
 * `chooseAction` é PURA e determinística dado o `rng` recebido: sem LLM, sem
 * I/O, sem `Date.now()`, sem `Math.random()`. Toda a aleatoriedade (desempate e
 * as policies de rollout) sai do `rng` seedado.
 *
 * ── Aproximação de informação oculta (LIMITAÇÃO HONESTA) ──────────────────────
 * O bot só enxerga a VIEW dele (`viewStateFor`), que redige mão/deck/shields do
 * oponente E o próprio deck/shields do bot. Mas o MCTS precisa de um
 * `GameState` COMPLETO pra rodar rollouts. A escolha aqui:
 *
 *   Determinização de "deck genérico". Toda carta oculta — deck e shields dos
 *   dois lados, mão do oponente — é substituída por um filler vanilla (Unit
 *   1/1 custo 1, ou Recurso incolor). Só o que a view revela de verdade entra
 *   real no estado especulado: as duas Battle Areas, as duas Base Sections,
 *   Resource Areas, trash/exile e a MÃO DO BOT (essa a view mostra).
 *
 * Consequência: o MCTS avalia bem a posição tática imediata (combate, unidades
 * em jogo, contagem de shields, as próximas jogadas da mão do bot) e trata
 * tudo que viria "de cima do deck" — dos dois lados — como ruído neutro. Não é
 * um bot perfeito; é um bot DIFÍCIL. Um oponente cujo deck tem bombas fortes no
 * fundo vai surpreender esse MCTS.
 *
 * Alternativa considerada e descartada: reconstruir os decks reais a partir das
 * `DeckList` (conhecidas no produto e no benchmark). Daria um bot mais forte,
 * mas exige passar as duas listas pra policy e casar cada carta visível contra
 * o multiset do deck — complexidade alta pro ganho, fora do escopo desta lane.
 *
 * ── Heurística como prior (por que não é MCTS puro) ──────────────────────────
 * Rollout curto com determinização grosseira é RUIDOSO — MCTS puro assim jogou
 * PIOR que a heurística `normal` no benchmark. Então o bot usa a heurística
 * como âncora: parte da ação que a heurística escolheria e só TROCA por outra
 * se os rollouts a colocarem à frente por uma margem (`OVERRIDE_MARGIN`). Na
 * prática o MCTS = "heurística, mas corrige quando o lookahead vê uma linha
 * claramente melhor (letal, troca melhor, não-suicídio)".
 *
 * Rollout truncado: se não decide em `depthTurns` turnos, em vez de 0.5 fixo o
 * rollout devolve uma AVALIAÇÃO da posição final (shields + Base + tabuleiro do
 * assento vs oponente) — dá gradiente onde 0.5 chapado não dava.
 *
 * ── Guarda de performance ────────────────────────────────────────────────────
 * `rollouts`, `depthTurns` e `maxBranching` limitam o custo. A determinização
 * roda UMA vez por decisão. Acima de `maxBranching` ações candidatas o bot só
 * joga a escolha da heurística (turnos de deploy têm muitas opções e a
 * heurística já resolve bem — o MCTS rende mesmo é em combate). Com os
 * defaults, uma decisão num deck ST fica abaixo de ~2s.
 */

export interface MctsPolicyOptions {
  /**
   * rollouts "cheios" por ação confirmada — default 32. A triagem das demais
   * candidatas usa ~1/3 disso.
   *
   * docs/44 §7.2 sugere 300, mas isso pressupõe rollout barato; aqui cada
   * rollout é uma PARTIDA CURTA completa (`simulateToEnd`), então 300 * (nº de
   * candidatos) estoura MUITO o teto de ~2s/decisão. 32 + triagem + confirmação
   * das 2 melhores mantém a decisão num deck ST abaixo de ~2s.
   */
  rollouts?: number;
  /** policy usada pelos dois lados dentro do rollout — default "heuristic" (nível normal) */
  rolloutPolicy?: "heuristic" | "random";
  /** rótulo de produto; o MCTS é sempre o nível "dificil" */
  level?: "dificil";
  /** horizonte do rollout = `view.turnNumber + depthTurns` — default 8 */
  depthTurns?: number;
  /** acima de tantas ações candidatas, joga direto a escolha da heurística (sem rollout) — default 12 */
  maxBranching?: number;
  /** só troca a escolha da heurística se outra ação vencer por esta margem de EV — default 0.2 */
  overrideMargin?: number;
  /** specs de efeito passados aos rollouts — o chamador deve passar os reais (ex. `ALL_EFFECT_SPECS`); `[]` = rollouts cegos a efeitos */
  specs?: EffectSpec[];
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
}

const DEFAULT_ROLLOUTS = 32;
const DEFAULT_DEPTH_TURNS = 8;
const DEFAULT_MAX_BRANCHING = 12;
/** ~1.6σ com 32 rollouts — abaixo disso "melhor que a âncora" é ruído, não sinal */
const DEFAULT_OVERRIDE_MARGIN = 0.2;

const FILLER_UNIT: CardDef = {
  code: "MCTS-FILLER-UNIT",
  nameEn: "Unidade genérica",
  cardType: "UNIT",
  color: "colorless",
  level: 1,
  cost: 1,
  ap: 1,
  hp: 1,
};

const FILLER_RESOURCE: CardDef = {
  code: "MCTS-FILLER-RESOURCE",
  nameEn: "Recurso genérico",
  cardType: "RESOURCE",
  color: "colorless",
};

/** seed derivado do rng do chamador — mantém tudo determinístico e puro */
function deriveRng(rng: Rng): Rng {
  const seed = Math.floor(rng() * 0x1_0000_0000) >>> 0;
  return createRng(seed === 0 ? 1 : seed);
}

function isReal(card: ViewCardInstance): card is CardInstance {
  return !("hidden" in card);
}

function fillerInstance(owner: PlayerId, zone: Zone, index: number, kind: "unit" | "resource"): CardInstance {
  return {
    instanceId: `mcts-${owner}-${zone}-${index}`,
    def: kind === "resource" ? FILLER_RESOURCE : FILLER_UNIT,
    owner,
    zone,
    rested: false,
    damage: 0,
    statModifiers: [],
    keywordGrants: [],
    usedKeywordsThisTurn: [],
    enteredZoneOnTurn: 0,
  };
}

function fillers(owner: PlayerId, zone: Zone, count: number, kind: "unit" | "resource"): CardInstance[] {
  const out: CardInstance[] = [];
  for (let i = 0; i < count; i++) out.push(fillerInstance(owner, zone, i, kind));
  return out;
}

/** só as cartas reais de uma zona pública da view (defensivo: qualquer `HiddenCard` numa zona que devia ser pública vira filler) */
function realOf(cards: ViewCardInstance[], owner: PlayerId, zone: Zone): CardInstance[] {
  return cards.map((c, i) => (isReal(c) ? c : fillerInstance(owner, zone, i, "unit")));
}

function reconstructPlayer(view: ViewGameState, pid: PlayerId): PlayerState {
  const vp = view.players[pid];
  const isViewer = pid === view.viewer;
  return {
    id: pid,
    deck: fillers(pid, "deck", vp.counts.deck, "unit"),
    resourceDeck: fillers(pid, "resourceDeck", vp.counts.resourceDeck, "resource"),
    shields: fillers(pid, "shields", vp.counts.shields, "unit"),
    resourceArea: realOf(vp.resourceArea, pid, "resourceArea"),
    battleArea: realOf(vp.battleArea, pid, "battleArea"),
    baseSection: realOf(vp.baseSection, pid, "baseSection"),
    trash: realOf(vp.trash, pid, "trash"),
    exile: realOf(vp.exile, pid, "exile"),
    hand: isViewer ? realOf(vp.hand, pid, "hand") : fillers(pid, "hand", vp.counts.hand, "unit"),
  };
}

/**
 * `ViewGameState` → `GameState` especulado. Sem `rng` — os fillers são fixos,
 * então a determinização é uma função pura do view. `cloneState` no final
 * isola as `CardInstance` reais que vieram por referência do view do chamador.
 */
export function determinize(view: ViewGameState): GameState {
  const state: GameState = {
    turnNumber: view.turnNumber,
    activePlayer: view.activePlayer,
    phase: view.phase,
    combat: view.combat,
    endPhaseAction: view.endPhaseAction,
    pendingDecision: view.pendingDecision,
    players: {
      A: reconstructPlayer(view, "A"),
      B: reconstructPlayer(view, "B"),
    },
    eventLog: [...view.eventLog],
    gameOver: view.gameOver,
    // acima de qualquer seq real (`${owner}-${n}`, n na casa das centenas) e dos ids `mcts-*`
    nextInstanceSeq: 1_000_000,
    seed: 1,
    engineVersion: view.engineVersion,
  };
  return cloneState(state);
}

/** força de um lado: shields e Base pesam (é como se ganha/perde), tabuleiro e mão entram diluídos */
function sideStrength(state: GameState, pid: PlayerId): number {
  const p = state.players[pid];
  const shields = p.shields.length;
  const baseHp = p.baseSection
    .filter((c) => c.def.cardType === "BASE")
    .reduce((s, c) => s + Math.max(0, effectiveHp(c, state) - c.damage), 0);
  const board = p.battleArea
    .filter((c) => c.def.cardType === "UNIT")
    .reduce((s, c) => s + effectiveAp(c, state) + Math.max(0, effectiveHp(c, state) - c.damage), 0);
  return shields * 3 + baseHp * 1.2 + board * 0.5 + p.hand.length * 0.25;
}

/** valor da posição pro `seat` em [0,1] — usado quando o rollout é truncado sem vencedor */
function positionValue(state: GameState, seat: PlayerId): number {
  const diff = sideStrength(state, seat) - sideStrength(state, otherPlayer(seat));
  return 0.5 + 0.5 * Math.tanh(diff / 9);
}

interface RolloutCfg {
  rollouts: number;
  depthTurns: number;
  specs: EffectSpec[];
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
  rolloutPolicy: SelfPlayPolicy;
}

/** média de `n` rollouts a partir de `afterAction`: 1 vitória / 0 derrota / `positionValue` se truncado */
function rolloutMean(afterAction: GameState, horizon: number, seat: PlayerId, n: number, cfg: RolloutCfg, rng: Rng): number {
  const resolvers = {
    predicateResolver: cfg.predicateResolver,
    targetFilterResolver: cfg.targetFilterResolver,
  };
  let score = 0;
  for (let r = 0; r < n; r++) {
    const result = simulateToEnd(afterAction, seat, cfg.specs, resolvers, {
      policyA: cfg.rolloutPolicy,
      policyB: cfg.rolloutPolicy,
      maxTurns: horizon,
      rng: deriveRng(rng),
      fastLegal: true,
    });
    if (result.winner === seat) score += 1;
    else if (result.winner === null) score += positionValue(result.finalState, seat);
    // derrota = 0
  }
  return score / n;
}

/** mesmo critério do `isPlainLegalityError` interno do `legalActions.ts` */
function isPlainLegalityError(err: unknown): boolean {
  return err instanceof Error && err.name === "Error";
}

/**
 * Aplica `action` no estado determinizado. Devolve `null` quando a ação é legal
 * na VIEW real mas não no estado especulado — acontece com efeitos que mexem em
 * zona oculta (ex. "olhe o topo 3 e revele", `lookAtTopFilterReveal`): a carta
 * escolhida de verdade não está no deck de fillers. O MCTS simplesmente não
 * avalia essas ações (fica com a âncora da heurística). Erro que NÃO é de
 * legalidade "plana" propaga — é achado de motor.
 */
function applyForEval(action: LegalAction, determinized: GameState, seat: PlayerId, cfg: RolloutCfg): GameState | null {
  try {
    return applyPlayerAction(determinized, seat, action, cfg.specs, cfg.predicateResolver, cfg.targetFilterResolver);
  } catch (err) {
    if (isPlainLegalityError(err)) return null;
    throw err;
  }
}

export function chooseAction(
  view: ViewGameState,
  legal: LegalAction[],
  rng: Rng,
  options: MctsPolicyOptions = {},
): LegalAction {
  if (legal.length === 0) {
    throw new Error("mctsPolicy: lista de ações legais vazia");
  }
  if (legal.length === 1) return legal[0];

  // âncora: o que a heurística normal jogaria aqui (rng derivado — não perturba a sequência principal)
  const heuristicPick = heuristicChoose(view, legal, deriveRng(rng), "normal");

  const maxBranching = options.maxBranching ?? DEFAULT_MAX_BRANCHING;
  if (legal.length > maxBranching) return heuristicPick;

  const cfg: RolloutCfg = {
    rollouts: options.rollouts ?? DEFAULT_ROLLOUTS,
    depthTurns: options.depthTurns ?? DEFAULT_DEPTH_TURNS,
    specs: options.specs ?? [],
    predicateResolver: options.predicateResolver,
    targetFilterResolver: options.targetFilterResolver,
    rolloutPolicy: options.rolloutPolicy === "random" ? randomLegal : heuristicPolicy({ level: "normal" }),
  };
  const overrideMargin = options.overrideMargin ?? DEFAULT_OVERRIDE_MARGIN;

  const seat = view.viewer;
  const determinized = determinize(view);
  const horizon = determinized.turnNumber + cfg.depthTurns;

  // 1) EV cheio da âncora (heurística). Se ela não é simulável no estado
  //    especulado (efeito de zona oculta), confia na heurística e sai.
  const anchorState = applyForEval(heuristicPick, determinized, seat, cfg);
  if (anchorState === null) return heuristicPick;
  const heuristicEv = rolloutMean(anchorState, horizon, seat, cfg.rollouts, cfg, rng);

  // 2) triagem das outras candidatas (1/3 dos rollouts); as promissoras passam
  const screenN = Math.max(10, Math.round(cfg.rollouts / 3));
  const contenders: Array<{ action: LegalAction; ev: number }> = [];
  for (const action of legal) {
    if (action === heuristicPick) continue;
    const state = applyForEval(action, determinized, seat, cfg);
    if (state === null) continue; // não avaliável no estado especulado
    const ev = rolloutMean(state, horizon, seat, screenN, cfg, rng);
    // só vale confirmar se a triagem já a colocou perto de superar a âncora
    if (ev >= heuristicEv - overrideMargin) contenders.push({ action, ev });
  }
  contenders.sort((a, b) => b.ev - a.ev);

  // 3) confirma as 2 melhores com EV cheio; troca a âncora só se superar por margem
  let bestAction = heuristicPick;
  let bestEv = heuristicEv;
  for (const c of contenders.slice(0, 2)) {
    const state = applyForEval(c.action, determinized, seat, cfg);
    if (state === null) continue;
    const ev = rolloutMean(state, horizon, seat, cfg.rollouts, cfg, rng);
    if (ev > bestEv + 1e-9) {
      bestEv = ev;
      bestAction = c.action;
    }
  }

  return bestEv >= heuristicEv + overrideMargin ? bestAction : heuristicPick;
}

export function mctsPolicy(options: MctsPolicyOptions = {}): SelfPlayPolicy {
  return (view, legal, rng) => chooseAction(view, legal, rng, options);
}
