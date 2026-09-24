import type { GameState, PlayerId } from "../types";
import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "../effectSpec";
import type { LegalAction } from "../legalActions";
import type { Rng } from "../rng";
import type { SelfPlayPolicy } from "../selfPlay";
import { randomLegal } from "../selfPlay";
import type { ViewGameState } from "../viewState";
import { chooseAction as heuristicChoose, heuristicPolicy } from "./heuristicPolicy";
import { simulateToEnd } from "./simulateToEnd";
import { applyForEval, deriveRng, determinize, positionValue } from "./evaluation";
import { EffectLookahead, type EffectLookaheadConfig } from "./actionLookahead";

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
  /**
   * Lookahead de efeitos na ÂNCORA (a escolha da heurística que o MCTS só troca
   * por margem). Os rollouts continuam com a heurística SEM lookahead — senão
   * cada passo de cada rollout pagaria a simulação do efeito.
   */
  lookahead?: EffectLookaheadConfig;
}

const DEFAULT_ROLLOUTS = 32;
const DEFAULT_DEPTH_TURNS = 8;
const DEFAULT_MAX_BRANCHING = 12;
/** ~1.6σ com 32 rollouts — abaixo disso "melhor que a âncora" é ruído, não sinal */
const DEFAULT_OVERRIDE_MARGIN = 0.2;

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

export function chooseAction(
  view: ViewGameState,
  legal: LegalAction[],
  rng: Rng,
  options: MctsPolicyOptions = {},
  lookahead: EffectLookahead | null = null,
): LegalAction {
  if (legal.length === 0) {
    throw new Error("mctsPolicy: lista de ações legais vazia");
  }
  if (legal.length === 1) return legal[0];

  // âncora: o que a heurística normal jogaria aqui (rng derivado — não perturba a sequência principal)
  const heuristicPick = heuristicChoose(view, legal, deriveRng(rng), "normal", lookahead);

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
  const lookahead = options.lookahead ? new EffectLookahead(options.lookahead, heuristicPolicy({ level: "normal" })) : null;
  return (view, legal, rng) => {
    const choice = chooseAction(view, legal, rng, options, lookahead);
    lookahead?.record(view.turnNumber, choice);
    return choice;
  };
}
