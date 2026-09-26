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
  specNeedsChoice,
  specNeedsNamedTarget,
} from "./effectSpec";
import type { EffectContext, EffectSpec, PredicateResolver, PrimitiveCall, TargetFilterResolver } from "./effectSpec";
import { applyEvents, findCard } from "./events";
import type { CardInstance, DestroyedInBattle, GameEvent, GameState, PendingDecision, PlayerId, QueuedTrigger } from "./types";
import { effectivePilotDef, otherPlayer, satisfiesLinkCondition, specPairGateOpen } from "./types";

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
  implicitTargets?: Record<string, string[]>,
): AbilityQueueEntry {
  const needsTarget = activeCalls ? callsNeedNamedTarget(activeCalls) : specNeedsNamedTarget(spec);
  const entry: AbilityQueueEntry = {
    sourceInstanceId,
    specId: spec.id,
    label: spec.sourceText,
    optional: spec.optional ?? false,
    needsTarget,
    targetScope: spec.targetScope ?? "enemyUnit",
    legalTargets: needsTarget ? computeLegalTargets(state, spec, player, targetFilterResolver, sourceInstanceId) : [],
    targetCount: spec.targetCount,
    implicitTargets,
    // docs/47 Fase 5 — ST05-010 Mikazuki Augus 【When Paired】: 2º pool de alvo
    // com escopo PRÓPRIO, igual ao já usado por Command (GD01-103/112), agora
    // também no caminho de fila (gatilho automático pausado).
    secondaryTarget: spec.secondaryTarget
      ? {
          name: spec.secondaryTarget.name,
          targetScope: spec.secondaryTarget.targetScope,
          legalTargets: computeLegalTargets(
            state,
            { targetScope: spec.secondaryTarget.targetScope, targetFilter: spec.secondaryTarget.targetFilter },
            player,
            targetFilterResolver,
            sourceInstanceId,
          ),
        }
      : undefined,
  };

  const choice = activeCalls ? callsChoicePrimitive(activeCalls) : specChoicePrimitive(spec);
  if (!choice) return entry;

  // GD02-071 Gundam Mk-II (AEUG) (`pairFromHandSearch`) reusa o MESMO shape de
  // `deployFromHandTriggered` — busca na MÃO inteira, só muda o destino (parear
  // com a fonte, não ir pra battleArea sozinha). Achado da revalidação Sprint 2
  // Fase 7: antes deste branch, o op nunca tinha uma entrada de fila própria —
  // `buildQueueEntry` caía no fallback de `moveWithinDeck`/`deckReorder` (só
  // funcionava via `resolveEffectSpec` chamado direto em teste, nunca pela UI real).
  if (choice.op === "deployFromHandTriggered" || choice.op === "pairFromHandSearch") {
    const chooser = resolvePlayerRef(choice.player, player);
    const wantsPilot = choice.op === "pairFromHandSearch";
    const legalHandIds = state.players[chooser].hand
      .filter((c) => c.def.cardType === (wantsPilot ? "PILOT" : "UNIT") && matchesCardDefFilter(c.def, choice.filter))
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
    const rawCandidates = discardCandidateHandIds(spec, state, player, implicitTargets, activeCalls);
    // Lote 5 (docs/debates 2026-09-13) — GD01-023 "Discard 1 (Zeon)/(Neo Zeon) Unit card"
    // (custo com filtro): restringe os candidatos, se o spec pedir.
    const legalHandIds = choice.filter ? rawCandidates.filter((id) => matchesCardDefFilter(findCard(state, id).def, choice.filter!)) : rawCandidates;
    return {
      ...entry,
      handDiscard: {
        n: choice.n,
        legalHandIds,
        label: spec.sourceText,
      },
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

  // Lote 5 (docs/debates 2026-09-13) — GD01-045: mesmo shape de lookAtTopFilterReveal,
  // só que o destino da carta escolhida é battleArea (deploy), não a mão.
  if (choice.op === "deployFromTopFilterReveal") {
    const chooser = resolvePlayerRef(choice.player, player);
    const topCards = peekAndReorderDeck(state, chooser, choice.count);
    const revealableIds = topCards
      .filter((c) => c.def.cardType === "UNIT" && matchesCardDefFilter(c.def, choice.filter))
      .map((c) => c.instanceId);
    return { ...entry, deckTopReveal: { topCards, revealableIds, count: choice.count, label: spec.sourceText } };
  }

  // GD01-067 — busca na lixeira (zona inteira, sempre visível, sem "topo N").
  // GD01-023 (pairFromTrashSearch) reusa o MESMO shape — só muda o destino (parear
  // com a fonte, não ir pra mão), a candidatura/validação de escolha é idêntica.
  // GD02-096/GD02-110 (deployFromTrashPayingCost) também reusa — destino é deploy
  // pagando o custo da carta escolhida, mas a busca/candidatura é a mesma coisa.
  if (choice.op === "searchTrashToHand" || choice.op === "pairFromTrashSearch" || choice.op === "deployFromTrashPayingCost") {
    const chooser = resolvePlayerRef(choice.player, player);
    const legalTrashIds = state.players[chooser].trash
      .filter((c) => (choice.op !== "deployFromTrashPayingCost" || c.def.cardType === "UNIT") && matchesCardDefFilter(c.def, choice.filter))
      .map((c) => c.instanceId);
    return { ...entry, trashSearch: { legalTrashIds, label: spec.sourceText } };
  }

  // GD01-039 — a posição em si (top/bottom) é a escolha; reusa enumChoice com opções fixas.
  if (choice.op === "moveTopCardToChosenPosition") {
    return {
      ...entry,
      enumChoice: {
        key: choice.optionsKey,
        options: [
          { value: "top", label: "Topo do deck" },
          { value: "bottom", label: "Fundo do deck" },
        ],
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
  /**
   * Lote 5 (docs/debates 2026-09-13) — GD01-005: alvo(s) que o motor já resolveu
   * (não o jogador) ANTES de despachar este gatilho — ex. `{ formerPairedPilot: [id] }`,
   * o Pilot que estava pareado com a Unit destruída (ver `DestroyedInBattle.formerPairedPilotId`).
   * Mesclado em `ctx.targets`/`AbilityQueueEntry.implicitTargets` tanto no caminho
   * imediato quanto no caminho de fila (`deferOrDispatchAbilities`).
   */
  implicitTargets?: Record<string, string[]>;
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
    findTriggerSpecs(specs, s.code, trigger)
      .filter((spec) => specPairGateOpen(state, findCard(state, s.instanceId), spec))
      .map((spec) => ({ spec, sourceInstanceId: s.instanceId, implicitTargets: s.implicitTargets })),
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
  const entriesWithCalls = entries.map(({ spec, sourceInstanceId, implicitTargets }) => {
    const ctx: EffectContext = {
      state,
      controller: player,
      sourceInstanceId,
      turnNumber: state.turnNumber,
      targets: { ...(opts.targets ?? {}), ...(implicitTargets ?? {}) },
    };
    const activeCalls = specActiveCalls(spec, ctx, opts.predicateResolver);
    return { spec, sourceInstanceId, activeCalls, implicitTargets };
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
    for (const { spec, sourceInstanceId, implicitTargets } of activeEntries) {
      queueBudget.count += 1;
      const guardedIter = checkTriggerLoopGuard(next, cascadeDepth, queueBudget);
      if (guardedIter) return guardedIter;
      next = dispatchTrigger(next, sourceInstanceId, trigger, [spec], {
        ...dispatchOpts,
        targets: { ...(dispatchOpts.targets ?? {}), ...(implicitTargets ?? {}) },
      });
      if (next.gameOver || next.pendingDecision.A || next.pendingDecision.B) return next; // 【Destroyed】 fora de combate pausou (ou guard estourou)
    }
    return next;
  }

  // automáticos primeiro; interativos vão pra fila da decisão.
  let next = state;
  for (const { spec, sourceInstanceId, implicitTargets } of activeEntries.filter((e) => !interactive.includes(e))) {
    queueBudget.count += 1;
    const guardedIter = checkTriggerLoopGuard(next, cascadeDepth, queueBudget);
    if (guardedIter) return guardedIter;
    next = dispatchTrigger(next, sourceInstanceId, trigger, [spec], {
      ...dispatchOpts,
      targets: { ...(dispatchOpts.targets ?? {}), ...(implicitTargets ?? {}) },
    });
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
        queue: interactive.map(({ spec, sourceInstanceId, activeCalls, implicitTargets }) =>
          buildQueueEntry(state, player, spec, sourceInstanceId, opts.targetFilterResolver, activeCalls, implicitTargets),
        ),
      },
    },
  ]);
}

/**
 * Compara o estado imediatamente ANTES de aplicar os eventos do Damage Step
 * com o de DEPOIS e devolve as Units que saíram da Battle Area pro trash neste
 * passo (mortes de batalha, `pairedPilotFollowEvents`, Breach letal,
 * combatTrigger letal). `wasPaired`/`wasLinkUnit`/`formerPairedPilotId` vêm do
 * snapshot de antes — depois do `DESTROY_CARD` a Unit já perdeu `pairedPilotId`.
 * Units devolvidas pra mão/deck (não pro trash) NÃO contam como destruídas.
 */
/** estado de pareamento de uma carta no snapshot `state` — Unit olha o Piloto dela; Piloto olha a Unit (E7) */
function pairingOf(card: CardInstance, state: GameState): { wasPaired: boolean; wasLinkUnit: boolean } {
  if (card.pairedPilotId) {
    const pilot = findCard(state, card.pairedPilotId);
    return { wasPaired: true, wasLinkUnit: satisfiesLinkCondition(effectivePilotDef(pilot), card.def) };
  }
  if (card.pairedUnitId) {
    const unit = findCard(state, card.pairedUnitId);
    return { wasPaired: true, wasLinkUnit: satisfiesLinkCondition(effectivePilotDef(card), unit.def) };
  }
  return { wasPaired: false, wasLinkUnit: false };
}

export function collectDestroyed(before: GameState, after: GameState): DestroyedInBattle[] {
  const out: DestroyedInBattle[] = [];
  for (const pid of ["A", "B"] as PlayerId[]) {
    const stillInPlay = new Set([...after.players[pid].battleArea, ...after.players[pid].baseSection].map((c) => c.instanceId));
    const inTrashNow = new Set(after.players[pid].trash.map((c) => c.instanceId));
    // Base também tem 【Destroyed】 (GD02-126/127) — antes só a Battle Area era vista. Mas a Base
    // que sai porque OUTRA entrou no lugar (CR 11-5-2-1, rules management) não é "destruída".
    const baseReplaced = after.players[pid].baseSection.some(
      (b) => !before.players[pid].baseSection.some((old) => old.instanceId === b.instanceId),
    );
    const candidates = [...before.players[pid].battleArea, ...(baseReplaced ? [] : before.players[pid].baseSection)];
    for (const card of candidates) {
      if (stillInPlay.has(card.instanceId)) continue;
      if (!inTrashNow.has(card.instanceId)) continue;
      const { wasPaired, wasLinkUnit } = pairingOf(card, before);
      out.push({
        instanceId: card.instanceId,
        owner: pid,
        wasPaired,
        wasLinkUnit,
        formerPairedPilotId: card.pairedPilotId,
      });
    }
  }
  return out;
}

/** Nome legado (só combate). Alias de `collectDestroyed` — a comparação é a mesma. */
export const collectDestroyedInBattle = collectDestroyed;

/**
 * Compara `before`/`after` e devolve as Units (de QUALQUER lado) que ganharam um
 * `pairedPilotId` novo neste passo (evento `PAIR_CARDS`) — não interessa QUEM
 * pareou, só QUAL Unit passou a estar pareada. Usado por
 * `dispatchAnyPairingFromEffect` (GD01-065 "When you pair a Pilot with this Unit
 * or one of your white Units, ...", Lote 5, docs/debates 2026-09-13).
 */
export function collectNewPairings(before: GameState, after: GameState): { owner: PlayerId; unitInstanceId: string }[] {
  const out: { owner: PlayerId; unitInstanceId: string }[] = [];
  for (const pid of ["A", "B"] as PlayerId[]) {
    const beforePairs = new Map(before.players[pid].battleArea.map((c) => [c.instanceId, c.pairedPilotId]));
    for (const card of after.players[pid].battleArea) {
      if (card.def.cardType !== "UNIT") continue;
      if (card.pairedPilotId && card.pairedPilotId !== beforePairs.get(card.instanceId)) {
        out.push({ owner: pid, unitInstanceId: card.instanceId });
      }
    }
  }
  return out;
}

/**
 * Despacha `EffectSpec.trigger: "AnyPairing"` pra toda Unit do CONTROLLER com
 * `CardDef.onAnyPairing` — reage a QUALQUER `PAIR_CARDS` do próprio controller
 * (não só quando a própria fonte é a Unit pareada), gateado por
 * `requiresPairedUnitColor` (cor da Unit RECÉM-pareada; "this Unit or one of your
 * white Units" colapsa pra isso, já que a própria fonte também tem essa cor).
 * `CardDef.oncePerTurn` (mecanismo já existente, `dispatchTrigger`) cobre o "Once
 * per Turn" — GD01-065. Chamado depois de QUALQUER `PAIR_CARDS` real: `deploy.ts`
 * (Pilot jogado da mão) e `dispatcher.ts` (qualquer EffectSpec cujas primitivas
 * pareiem, ex. `pairFromTrashSearch` de GD01-023).
 */
export function dispatchAnyPairingFromEffect(
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
  const newPairings = collectNewPairings(before, after);
  if (newPairings.length === 0) return after;

  let next = after;
  for (const np of newPairings) {
    const pairedUnit = findCard(next, np.unitInstanceId);
    const reactive = next.players[np.owner].battleArea.filter(
      (c) =>
        c.def.cardType === "UNIT" &&
        c.def.onAnyPairing &&
        // `deferOrDispatchAbilities` (ao contrário de `dispatchTrigger`) não checa
        // `oncePerTurn` sozinho — sem isso, uma 2ª ativação no mesmo turno pausaria
        // pra escolha de novo mesmo já tendo sido usada (a marcação só acontece
        // DEPOIS, quando `resolveAbility` finalmente chama `dispatchTrigger`).
        !(c.def.oncePerTurn && c.usedKeywordsThisTurn.includes("AnyPairing")) &&
        (!c.def.onAnyPairing.requiresPairedUnitColor || c.def.onAnyPairing.requiresPairedUnitColor === pairedUnit.def.color),
    );
    if (reactive.length === 0) continue;
    next = deferOrDispatchAbilities(
      next,
      np.owner,
      "AnyPairing",
      reactive.map((c) => ({ code: c.def.code, instanceId: c.instanceId })),
      specs,
      opts,
    );
    if (next.gameOver || next.pendingDecision.A || next.pendingDecision.B) return next;
  }
  return next;
}

/**
 * E6 — pareamento feito por EFEITO (`pairFromHandSearch`/`pairFromTrashSearch`) dispara os
 * mesmos 【When Paired】 (Unit + Pilot) e 【When Linked】 (se formou Link Unit) que o
 * pareamento da jogada normal (`deploy.ts`). Antes só o "AnyPairing" reativo disparava.
 */
export function dispatchPairingTriggersFromEffect(
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
  return drainQueuedTriggers(after, pairingTriggerEntries(before, after), specs, opts);
}

/** 【When Paired】 (+ 【When Linked】 se formou Link) de cada pareamento novo entre `before` e `after` */
export function pairingTriggerEntries(before: GameState, after: GameState): QueuedTrigger[] {
  const entries: QueuedTrigger[] = [];
  for (const np of collectNewPairings(before, after)) {
    const unit = findCard(after, np.unitInstanceId);
    if (!unit.pairedPilotId) continue;
    const pilot = findCard(after, unit.pairedPilotId);
    const sources = [
      { code: unit.def.code, instanceId: unit.instanceId },
      { code: pilot.def.code, instanceId: pilot.instanceId },
    ];
    entries.push({ owner: np.owner, trigger: "When Paired", sources });
    if (satisfiesLinkCondition(effectivePilotDef(pilot), unit.def)) entries.push({ owner: np.owner, trigger: "When Linked", sources });
  }
  return entries;
}

/** pendura `entries` na decisão pendente (a que acabou de pausar) — elas disparam quando ela fechar */
export function attachQueuedTriggers(state: GameState, entries: QueuedTrigger[]): GameState {
  if (entries.length === 0) return state;
  for (const p of ["A", "B"] as PlayerId[]) {
    const d = state.pendingDecision[p];
    if (d && (d.kind === "abilityResolution" || d.kind === "triggerOrder")) {
      return { ...state, pendingDecision: { ...state.pendingDecision, [p]: { ...d, queuedTriggers: [...(d.queuedTriggers ?? []), ...entries] } } };
    }
  }
  return state;
}

/** despacha a fila em ordem; se um deles pausar, o resto fica pendurado na nova decisão */
export function drainQueuedTriggers(
  state: GameState,
  entries: QueuedTrigger[],
  specs: EffectSpec[],
  opts: {
    targets?: Record<string, string[]>;
    predicateResolver?: PredicateResolver;
    targetFilterResolver?: TargetFilterResolver;
    cascadeDepth?: number;
    queueBudget?: TriggerQueueBudget;
  } = {},
): GameState {
  let next = state;
  for (let i = 0; i < entries.length; i++) {
    if (next.gameOver) return next;
    const entry = entries[i];
    next = deferOrDispatchAbilities(next, entry.owner, entry.trigger, entry.sources, specs, opts);
    if (next.pendingDecision.A || next.pendingDecision.B) return attachQueuedTriggers(next, entries.slice(i + 1));
  }
  return next;
}

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

/** Lançada quando o guard anti-loop estoura em ambiente de teste — falha alta e legível em vez de travar o worker/CI. Carrega os últimos eventos do `eventLog` pra facilitar o repro. */
export class TriggerLoopException extends Error {
  readonly recentEvents: GameEvent[];

  constructor(message: string, recentEvents: GameEvent[]) {
    super(message);
    this.name = "TriggerLoopException";
    this.recentEvents = recentEvents;
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

  const isTestEnv = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";

  if (isTestEnv) {
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
 * `wasPaired`/`wasLinkUnit` vêm do snapshot `before` (a Unit perde `pairedPilotId`
 * ao ir pro trash) — habilitam o gate 【During Pair】【Destroyed】 (ST04-009 Miguel's
 * Ginn) e 【During Link】【Destroyed】 (GD01-005 Unicorn Gundam), respectivamente.
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
    return findTriggerSpecs(specs, card.def.code, "Destroyed").some(
      (s) => !((s.duringPair ?? false) && !d.wasPaired) && !((s.duringLink ?? false) && !d.wasLinkUnit),
    );
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
 * - 【During Link】【Destroyed】 (`spec.duringLink`): só dispara se `wasLinkUnit`
 *   (GD01-005 — mais estrito, exige o Pilot LINKADO, não qualquer Pilot).
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
      (s) => !((s.duringPair ?? false) && !d.wasPaired) && !((s.duringLink ?? false) && !d.wasLinkUnit),
    );
    if (triggerSpecs.length === 0) continue;

    // Lote 5 (docs/debates 2026-09-13) — GD01-005: o Pilot que estava pareado
    // ANTES da destruição vira alvo implícito "formerPairedPilot", disponível
    // pra `moveZone`/`discardNamed` do spec sem escolha do jogador.
    const implicitTargets: Record<string, string[]> | undefined = d.formerPairedPilotId
      ? { formerPairedPilot: [d.formerPairedPilotId] }
      : undefined;

    const interactive = triggerSpecs.filter(
      (s) => (s.optional ?? false) || specNeedsNamedTarget(s) || specNeedsChoice(s),
    );
    for (const spec of triggerSpecs.filter((s) => !interactive.includes(s))) {
      queueBudget.count += 1;
      const guardedIter = checkTriggerLoopGuard(next, cascadeDepth, queueBudget);
      if (guardedIter) return guardedIter;
      next = dispatchTrigger(next, d.instanceId, "Destroyed", [spec], {
        ...dispatchOpts,
        targets: implicitTargets ?? {},
      });
      if (next.gameOver || next.pendingDecision.A || next.pendingDecision.B) return next; // encadeamento pausou (ou guard estourou)
    }
    if (interactive.length > 0) {
      interactiveByOwner[d.owner].push({ code: card.def.code, instanceId: d.instanceId, implicitTargets });
    }
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
    const legal = computeLegalTargets(state, spec, controller, targetFilterResolver, sourceInstanceId);
    if (legal.length === 0) return false;
    const chosen = suppliedTargetIds?.[0];
    if (!chosen || !legal.includes(chosen)) {
      throw new Error(`Alvo inválido pra ${spec.id} — escolha um dos alvos legais mostrados no tabuleiro.`);
    }
    return true;
  });
}
