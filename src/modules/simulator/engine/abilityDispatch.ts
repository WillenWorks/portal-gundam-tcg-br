/* "Dispara agora, ou PAUSA pra o jogador resolver" — vocabulário compartilhado
 * entre 【When Paired】 (ao parear Piloto, `deploy.ts`) e 【Attack】 (ao declarar
 * ataque, `actions.ts`), e reaproveitável por qualquer gatilho futuro que possa
 * ser optativo ou precisar de alvo escolhido num momento separado da ação.
 *
 * Regra: se algum EffectSpec do `trigger` é `optional` OU consome
 * `ctx.targets.target` E o alvo não veio pronto (`opts.targets`), grava
 * `PendingDecision.abilityResolution` pro `player` — o jogador ordena os efeitos
 * simultâneos, escolhe o alvo de cada um e ativa/pula os optativos. Os demais
 * (self / mandatório sem alvo) resolvem na hora, antes da pausa. */
import { dispatchTrigger, findTriggerSpecs } from "./dispatcher";
import {
  callsChoicePrimitive,
  callsNeedChoice,
  callsNeedNamedTarget,
  computeLegalTargets,
  discardCandidateHandIds,
  matchesCardDefFilter,
  peekAndReorderDeck,
  resolvePlayerRef,
  specActiveCalls,
  specChoicePrimitive,
  specChoicePrimitives,
  specNeedsChoice,
  specNeedsNamedTarget,
} from "./effectSpec";
import type { EffectContext, EffectSpec, PredicateResolver, PrimitiveCall, TargetFilterResolver } from "./effectSpec";
import { applyEvents, findCard } from "./events";
import type { DestroyedInBattle, GameEvent, GameState, PendingDecision, PlayerId } from "./types";
import { otherPlayer } from "./types";

/**
 * Orçamento COMPARTILHADO (mesma referência ao longo de toda a árvore de
 * despacho de UMA ação de jogador) de quantos gatilhos já foram processados
 * — guarda de LARGURA (`MAX_QUEUE_BREADTH`), independente de recursão.
 * Objeto mutável de propósito: threadear um contador por valor por cima de
 * um motor de estado imutável obrigaria toda função de despacho (e seus
 * chamadores em deploy.ts/actions.ts/combat.ts) a devolver uma tupla
 * `{state, count}` em vez de só `GameState` — mudança bem maior que o guard
 * em si. O objeto é descartado no fim de cada ação; nunca sobrevive a ela.
 */
export interface TriggerQueueBudget {
  count: number;
}

type AbilityQueueEntry = Extract<PendingDecision, { kind: "abilityResolution" }>["queue"][number];

/**
 * Monta a entrada da fila de `abilityResolution` pra 1 spec interativo. Se o
 * spec usa `deployFromHandTriggered`/`lookAtTopFilterReveal`, calcula aqui (no
 * servidor, uma única vez) o conjunto de cartas elegíveis — `resolveAbility`
 * valida a escolha do cliente contra ele, nunca confia cegamente.
 */
function buildQueueEntry(
  state: GameState,
  player: PlayerId,
  spec: EffectSpec,
  sourceInstanceId: string,
  targetFilterResolver?: TargetFilterResolver,
  activeCalls?: PrimitiveCall[],
): AbilityQueueEntry {
  const needsTarget = activeCalls ? callsNeedNamedTarget(activeCalls) : specNeedsNamedTarget(spec);
  const entry: AbilityQueueEntry = {
    sourceInstanceId,
    specId: spec.id,
    label: spec.sourceText,
    optional: spec.optional ?? false,
    needsTarget,
    targetScope: spec.targetScope ?? "enemyUnit",
    legalTargets: needsTarget ? computeLegalTargets(state, spec, player, targetFilterResolver) : [],
  };

  const choice = activeCalls ? callsChoicePrimitive(activeCalls) : specChoicePrimitive(spec);
  if (!choice) return entry;

  if (choice.op === "deployFromHandTriggered") {
    const chooser = resolvePlayerRef(choice.player, player);
    const legalHandIds = state.players[chooser].hand
      .filter((c) => c.def.cardType === "UNIT" && matchesCardDefFilter(c.def, choice.filter))
      .map((c) => c.instanceId);
    return { ...entry, handChoice: { legalHandIds, label: spec.sourceText } };
  }

  if (choice.op === "lookAtTopFilterReveal") {
    const chooser = resolvePlayerRef(choice.player, player);
    const topCards = peekAndReorderDeck(state, chooser, choice.count);
    const revealableIds = topCards.filter((c) => matchesCardDefFilter(c.def, choice.filter)).map((c) => c.instanceId);
    return { ...entry, deckTopReveal: { topCards, revealableIds, count: choice.count, label: spec.sourceText } };
  }

  if (choice.op === "discardNamed") {
    return {
      ...entry,
      handDiscard: { n: choice.n, legalHandIds: discardCandidateHandIds(spec, state, player), label: spec.sourceText },
    };
  }

  if (choice.op === "spawnTokenChoice") {
    return {
      ...entry,
      enumChoice: {
        key: choice.key,
        options: choice.options.map((o) => ({ value: o.value, label: o.label })),
        label: spec.sourceText,
      },
    };
  }

  // moveWithinDeck nomeado — ST02-015 tem 2 (topo + fundo) = 1 reordenação.
  const reorderPool =
    activeCalls ?? [...(spec.cost ?? []), ...(spec.condition?.then ?? []), ...(spec.condition?.else ?? []), ...spec.actions];
  const reorderCalls = reorderPool.filter(
    (c): c is Extract<typeof c, { op: "moveWithinDeck" }> => c.op === "moveWithinDeck" && c.target.kind === "named",
  );
  const slots = reorderCalls.map((c) => ({
    name: c.target.kind === "named" ? c.target.name : "",
    position: c.position,
  }));
  const topCards = peekAndReorderDeck(state, player, slots.length);
  return { ...entry, deckReorder: { topCards, slots, label: spec.sourceText } };
}

export interface AbilitySource {
  code: string;
  instanceId: string;
}

export function deferOrDispatchAbilities(
  state: GameState,
  player: PlayerId,
  trigger: string,
  sources: AbilitySource[],
  specs: EffectSpec[],
  opts: {
    targets?: Record<string, string[]>;
    predicateResolver?: PredicateResolver;
    targetFilterResolver?: TargetFilterResolver;
    cascadeDepth?: number;
    queueBudget?: TriggerQueueBudget;
  } = {},
): GameState {
  const cascadeDepth = opts.cascadeDepth ?? 0;
  const queueBudget = opts.queueBudget ?? { count: 0 };
  const guarded = checkTriggerLoopGuard(state, cascadeDepth, queueBudget);
  if (guarded) return guarded;

  const entries = sources.flatMap((s) =>
    findTriggerSpecs(specs, s.code, trigger).map((spec) => ({ spec, sourceInstanceId: s.instanceId })),
  );
  if (entries.length === 0) return state;

  const dispatchOpts = {
    targets: opts.targets,
    predicateResolver: opts.predicateResolver,
    targetFilterResolver: opts.targetFilterResolver,
    allSpecs: specs,
    cascadeDepth,
    queueBudget,
  };

  // Avalia as chamadas ativas de cada spec no contexto atual
  const entriesWithCalls = entries.map(({ spec, sourceInstanceId }) => {
    const ctx: EffectContext = {
      state,
      controller: player,
      sourceInstanceId,
      turnNumber: state.turnNumber,
      targets: opts.targets ?? {},
    };
    const activeCalls = specActiveCalls(spec, ctx, opts.predicateResolver);
    return { spec, sourceInstanceId, activeCalls };
  });

  // Descarta specs cujo efeito é incondicionalmente vazio no estado atual
  // (ex: condição falhou e não tem `else` nem `actions` fora da condição)
  const activeEntries = entriesWithCalls.filter(({ spec, activeCalls }) => {
    if (spec.condition && activeCalls.length === 0) return false;
    return true;
  });
  if (activeEntries.length === 0) return state;

  const interactive = activeEntries.filter(
    ({ spec, activeCalls }) =>
      (spec.optional ?? false) || callsNeedNamedTarget(activeCalls) || callsNeedChoice(activeCalls),
  );

  // alvo já veio pronto (compat com testes/IA) ou nada precisa de interação: resolve tudo na hora.
  if (interactive.length === 0 || opts.targets) {
    let next = state;
    for (const { spec, sourceInstanceId } of activeEntries) {
      queueBudget.count += 1;
      const guardedIter = checkTriggerLoopGuard(next, cascadeDepth, queueBudget);
      if (guardedIter) return guardedIter;
      next = dispatchTrigger(next, sourceInstanceId, trigger, [spec], dispatchOpts);
      if (next.gameOver || next.pendingDecision.A || next.pendingDecision.B) return next; // 【Destroyed】 fora de combate pausou (ou guard estourou)
    }
    return next;
  }

  // automáticos primeiro; interativos vão pra fila da decisão.
  let next = state;
  for (const { spec, sourceInstanceId } of activeEntries.filter((e) => !interactive.includes(e))) {
    queueBudget.count += 1;
    const guardedIter = checkTriggerLoopGuard(next, cascadeDepth, queueBudget);
    if (guardedIter) return guardedIter;
    next = dispatchTrigger(next, sourceInstanceId, trigger, [spec], dispatchOpts);
    if (next.gameOver || next.pendingDecision.A || next.pendingDecision.B) return next;
  }
  return applyEvents(next, [
    {
      type: "SET_PENDING_DECISION",
      player,
      decision: {
        kind: "abilityResolution",
        trigger,
        // V0 (docs/25): candidatos legais (alvo em campo, carta da mão, topo do
        // deck) calculados UMA VEZ aqui, no servidor — a UI só lista,
        // `resolveAbility` valida contra isto (nunca confia no cliente).
        queue: interactive.map(({ spec, sourceInstanceId, activeCalls }) =>
          buildQueueEntry(state, player, spec, sourceInstanceId, opts.targetFilterResolver, activeCalls),
        ),
      },
    },
  ]);
}

/**
 * Compara o estado imediatamente ANTES de aplicar os eventos do Damage Step
 * com o de DEPOIS e devolve as Units que saíram da Battle Area pro trash neste
 * passo (mortes de batalha, `pairedPilotFollowEvents`, Breach letal,
 * combatTrigger letal). `wasPaired` vem do snapshot de antes — depois do
 * `DESTROY_CARD` a Unit já perdeu `pairedPilotId`. Units devolvidas pra
 * mão/deck (não pro trash) NÃO contam como destruídas.
 */
export function collectDestroyed(before: GameState, after: GameState): DestroyedInBattle[] {
  const out: DestroyedInBattle[] = [];
  for (const pid of ["A", "B"] as PlayerId[]) {
    const stillInPlay = new Set(after.players[pid].battleArea.map((c) => c.instanceId));
    const inTrashNow = new Set(after.players[pid].trash.map((c) => c.instanceId));
    for (const card of before.players[pid].battleArea) {
      if (stillInPlay.has(card.instanceId)) continue;
      if (!inTrashNow.has(card.instanceId)) continue;
      out.push({ instanceId: card.instanceId, owner: pid, wasPaired: !!card.pairedPilotId });
    }
  }
  return out;
}

/** Nome legado (só combate). Alias de `collectDestroyed` — a comparação é a mesma. */
export const collectDestroyedInBattle = collectDestroyed;

/**
 * docs/debates/2026-09-12 e 2026-09-13 — incidente real de travamento de ~4h
 * num playtest manual: a guarda `MAX_TRIGGER_CHUNKS` tinha sido consensuada
 * (95%) e nunca chegou a virar código; o único guard existente
 * (`MAX_DESTROYED_CHAIN`, removido nesta mudança) só cobria a cascata
 * 【Destroyed】→【Destroyed】, deixando sem teto o encadeamento 【Burst】→【Deploy】
 * e qualquer par de efeitos que se retrigassem mutuamente. `MAX_CASCADE_DEPTH`
 * e `MAX_QUEUE_BREADTH` generalizam pra QUALQUER cadeia de gatilho, com 2
 * eixos independentes (2º debate, achado do Gemini): um Board Wipe late-game
 * legítimo pode gerar dezenas de gatilhos em LARGURA (sem loop nenhum) — só a
 * PROFUNDIDADE de recursão é sintoma real de loop infinito.
 */
export const MAX_CASCADE_DEPTH = 12;
/** Teto de LARGURA — total de gatilhos processados numa única ação, mesmo sem recursão (ex.: Board Wipe destruindo várias Units pareadas de uma vez). */
export const MAX_QUEUE_BREADTH = 150;

/** Lançada quando o guard anti-loop estoura em `process.env.NODE_ENV === "test"` — falha alta e legível em vez de travar o worker/CI. Carrega os últimos eventos do `eventLog` pra facilitar o repro. */
export class TriggerLoopException extends Error {
  constructor(
    message: string,
    public readonly recentEvents: GameEvent[],
  ) {
    super(message);
    this.name = "TriggerLoopException";
  }
}

/**
 * Guarda anti-loop-infinito de despacho de gatilhos. Chamado no topo de todo
 * método de despacho recursivo (`dispatchTrigger`, `dispatchDestroyedTriggers`,
 * `deferOrDispatchAbilities`) antes de processar mais um gatilho.
 *
 * - Em teste (`NODE_ENV === "test"`): lança `TriggerLoopException` — o teste
 *   falha com mensagem clara em vez de travar o worker inteiro.
 * - Em partida real: devolve o estado com `GAME_OVER`/`winner: null`/
 *   `reason: "trigger_loop_guard"` — empate determinístico, a mesma resolução
 *   que TCGs físicos usam pra loop sem progresso (nunca crash pro jogador).
 *
 * Devolve `null` quando os dois tetos ainda não estouraram (segue normal).
 */
export function checkTriggerLoopGuard(
  state: GameState,
  cascadeDepth: number,
  queueBudget: TriggerQueueBudget,
): GameState | null {
  if (cascadeDepth <= MAX_CASCADE_DEPTH && queueBudget.count <= MAX_QUEUE_BREADTH) return null;

  const cause =
    cascadeDepth > MAX_CASCADE_DEPTH
      ? `profundidade de cascata (${cascadeDepth}) excedeu MAX_CASCADE_DEPTH (${MAX_CASCADE_DEPTH})`
      : `largura da fila de gatilhos (${queueBudget.count}) excedeu MAX_QUEUE_BREADTH (${MAX_QUEUE_BREADTH})`;
  const recentEvents = state.eventLog.slice(-20);

  if (process.env.NODE_ENV === "test") {
    throw new TriggerLoopException(
      `Loop de gatilhos detectado: ${cause}. Últimos ${recentEvents.length} eventos anexados em .recentEvents.`,
      recentEvents,
    );
  }

  return applyEvents(state, [{ type: "GAME_OVER", winner: null, reason: "trigger_loop_guard" }]);
}

/**
 * docs/45 — 【Destroyed】 disparado FORA do Damage Step: `dispatchTrigger`
 * (dispatcher.ts) chama isto depois de aplicar os eventos de CADA EffectSpec
 * (Close Combat 【Main】, Rewloola 【Deploy】, GD01-044 Kshatriya 【When Paired】…).
 * O Damage Step tem caminho próprio (`actions.ts` → `dispatchDestroyedTriggers`
 * direto) e NUNCA passa por aqui — `resolveDamageStep`/Breach/`combatTriggerEvents`
 * não usam `dispatchTrigger`.
 *
 * `wasPaired` vem do snapshot `before` (a Unit perde `pairedPilotId` ao ir pro
 * trash) — habilita o gate 【During Pair】【Destroyed】 (ST04-009 Miguel's Ginn).
 */
export function dispatchDestroyedFromEffect(
  before: GameState,
  after: GameState,
  specs: EffectSpec[],
  opts: {
    predicateResolver?: PredicateResolver;
    targetFilterResolver?: TargetFilterResolver;
    cascadeDepth?: number;
    queueBudget?: TriggerQueueBudget;
  } = {},
): GameState {
  const destroyed = collectDestroyed(before, after).filter((d) => {
    const card = findCard(after, d.instanceId);
    return findTriggerSpecs(specs, card.def.code, "Destroyed").some((s) => !((s.duringPair ?? false) && !d.wasPaired));
  });
  if (destroyed.length === 0) return after;
  return dispatchDestroyedTriggers(after, destroyed, specs, opts);
}

/**
 * Dispara 【Destroyed】 das Units destruídas num Damage Step (docs/44). Chamado
 * UMA vez por batalha (ver `actions.ts`), sempre DEPOIS do dano/Breach e da
 * fila de 【Burst】 — Comprehensive Rules: 【Burst】 e 【Destroyed】 do mesmo evento
 * são simultâneos e o jogador ativo os ordena; fixamos 【Burst】→【Destroyed】
 * (decisão documentada, evita interleave de duas pausas).
 *
 * - 【During Pair】【Destroyed】 (`spec.duringPair`): só dispara se `wasPaired`.
 * - Sem pausa (ST04-009 Miguel's Ginn — `condition` + `draw`): resolve inline
 *   via `dispatchTrigger`.
 * - Com pausa (ST03-006 Char's Zaku Ⅱ — `lookAtTopFilterReveal`, `optional`):
 *   vira `PendingDecision.abilityResolution` com `deckTopReveal` pro dono,
 *   resolvida antes do Battle End Step (ver `resolveAbility` em `actions.ts`).
 *
 * Ordem: Units do jogador ativo primeiro. Se os DOIS lados têm 【Destroyed】 que
 * pausa no mesmo step (extremamente raro — exige 2 Char's Zaku Ⅱ mortas num
 * AoE, uma de cada lado), a do jogador ativo vira `abilityResolution` e a do
 * oponente entra em `queuedDestroyed` (FIFO): `resolveAbility` a dispara quando
 * a primeira fecha (docs/45). Nunca 2 `pendingDecision` simultâneos.
 */
export function dispatchDestroyedTriggers(
  state: GameState,
  destroyed: DestroyedInBattle[],
  specs: EffectSpec[],
  opts: {
    predicateResolver?: PredicateResolver;
    targetFilterResolver?: TargetFilterResolver;
    cascadeDepth?: number;
    queueBudget?: TriggerQueueBudget;
  } = {},
): GameState {
  const cascadeDepth = opts.cascadeDepth ?? 0;
  const queueBudget = opts.queueBudget ?? { count: 0 };
  const guarded = checkTriggerLoopGuard(state, cascadeDepth, queueBudget);
  if (guarded) return guarded;

  const active = state.activePlayer;
  const ordered = [...destroyed].sort((a, b) => Number(b.owner === active) - Number(a.owner === active));
  const dispatchOpts = {
    predicateResolver: opts.predicateResolver,
    targetFilterResolver: opts.targetFilterResolver,
    allSpecs: specs,
    cascadeDepth,
    queueBudget,
  };

  let next = state;
  const interactiveByOwner: Record<PlayerId, AbilitySource[]> = { A: [], B: [] };

  for (const d of ordered) {
    const card = findCard(next, d.instanceId);
    const triggerSpecs = findTriggerSpecs(specs, card.def.code, "Destroyed").filter(
      (s) => !((s.duringPair ?? false) && !d.wasPaired),
    );
    if (triggerSpecs.length === 0) continue;

    const interactive = triggerSpecs.filter(
      (s) => (s.optional ?? false) || specNeedsNamedTarget(s) || specNeedsChoice(s),
    );
    for (const spec of triggerSpecs.filter((s) => !interactive.includes(s))) {
      queueBudget.count += 1;
      const guardedIter = checkTriggerLoopGuard(next, cascadeDepth, queueBudget);
      if (guardedIter) return guardedIter;
      next = dispatchTrigger(next, d.instanceId, "Destroyed", [spec], dispatchOpts);
      if (next.gameOver || next.pendingDecision.A || next.pendingDecision.B) return next; // encadeamento pausou (ou guard estourou)
    }
    if (interactive.length > 0) interactiveByOwner[d.owner].push({ code: card.def.code, instanceId: d.instanceId });
  }

  const opp = otherPlayer(active);
  if (interactiveByOwner[active].length > 0) {
    next = deferOrDispatchAbilities(next, active, "Destroyed", interactiveByOwner[active], specs, {
      ...opts,
      cascadeDepth,
      queueBudget,
    });
  }
  if (interactiveByOwner[opp].length > 0) {
    const activePending = next.pendingDecision[active];
    if (activePending?.kind === "abilityResolution") {
      // FIFO (docs/45): a pausa do oponente entra na decisão do ativo; drenada por `resolveAbility`.
      next = applyEvents(next, [
        {
          type: "SET_PENDING_DECISION",
          player: active,
          decision: { ...activePending, queuedDestroyed: { owner: opp, sources: interactiveByOwner[opp] } },
        },
      ]);
    } else if (!next.pendingDecision.A && !next.pendingDecision.B) {
      next = deferOrDispatchAbilities(next, opp, "Destroyed", interactiveByOwner[opp], specs, {
        ...opts,
        cascadeDepth,
        queueBudget,
      });
    }
  }
  return next;
}

/**
 * Pro fluxo DIRETO/síncrono — sem pausa (Command 【Main】/【Action】, 【Burst】,
 * 【Activate·Main】/【Activate·Action】): filtra `specs` ANTES de despachar, pra
 * `dispatchTrigger` nunca tentar resolver um alvo nomeado que não é legal
 * agora (ou que nem foi escolhido). Mesma régua do V0 (docs/25) pro caminho
 * que NÃO passa por `deferOrDispatchAbilities`.
 *
 * - alvo legal existe mas nada foi escolhido, ou o escolhido não é legal ->
 *   lança (o cliente devia ter mostrado só os legais — se chegou aqui errado,
 *   é bug de UI ou tentativa de burlar; não aplica em silêncio).
 * - nenhum alvo legal existe agora -> spec sai do lote a despachar (efeito
 *   não ativa, regra oficial), SEM lançar erro — a carta/ação em si segue.
 * - spec não precisa de alvo nomeado -> passa direto, sem checagem nenhuma.
 */
export function filterDispatchableSpecs(
  state: GameState,
  cardCode: string,
  trigger: string,
  specs: EffectSpec[],
  controller: PlayerId,
  suppliedTargetIds: string[] | undefined,
  targetFilterResolver?: TargetFilterResolver,
  predicateResolver?: PredicateResolver,
  sourceInstanceId?: string,
): EffectSpec[] {
  return findTriggerSpecs(specs, cardCode, trigger).filter((spec) => {
    const ctx: EffectContext = {
      state,
      controller,
      sourceInstanceId: sourceInstanceId ?? "",
      turnNumber: state.turnNumber,
      targets: suppliedTargetIds ? { target: suppliedTargetIds } : {},
    };
    const activeCalls = specActiveCalls(spec, ctx, predicateResolver);
    if (spec.condition && activeCalls.length === 0) return false;
    if (!callsNeedNamedTarget(activeCalls)) return true;
    const legal = computeLegalTargets(state, spec, controller, targetFilterResolver);
    if (legal.length === 0) return false;
    const chosen = suppliedTargetIds?.[0];
    if (!chosen || !legal.includes(chosen)) {
      throw new Error(`Alvo inválido pra ${spec.id} — escolha um dos alvos legais mostrados no tabuleiro.`);
    }
    return true;
  });
}
