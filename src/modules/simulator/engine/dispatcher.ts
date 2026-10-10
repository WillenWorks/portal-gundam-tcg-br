import type { CardInstance, GameState, PlayerId } from "./types";
import { otherPlayer, specPairGateOpen } from "./types";
import type { EffectContext, EffectSpec, PredicateResolver, PrimitiveCall, TargetFilterResolver } from "./effectSpec";
import { isFollowUpTrigger, resolveCallTargetIds, resolveEffectSpec, specActiveCalls } from "./effectSpec";
import { applyEvent, applyEvents, findCard } from "./events";
import {
  checkTriggerLoopGuard,
  deferOrDispatchAbilities,
  dispatchAnyPairingFromEffect,
  dispatchDestroyedFromEffect,
  dispatchPairingTriggersFromEffect,
  dispatchReactionsFromEffect,
  dispatchReactions,
  paidForUnitEffectOccurrence,
  resourcePaymentAmount,
  attachQueuedTriggers,
  markCommandTraitsActivated,
  pairingTriggerEntries,
} from "./abilityDispatch";
import type { TriggerQueueBudget } from "./abilityDispatch";

/**
 * Dispatcher automático de trigger (docs/18, "Motor de jogo real + gaps
 * documentados", decisão tomada com o Willen em 2026-08-28) — a peça que
 * faltava pra não precisar montar `EffectContext` à mão em cada teste
 * (`st01.test.ts`/`st02.test.ts` faziam isso, documentado como provisório:
 * "Nenhum disparo automático existe ainda... isso é trabalho de dispatcher,
 * ortogonal a autoria de conteúdo", comentário no topo de `content/st01.ts`).
 *
 * Escopo desta wave: dispara os triggers pontuais que já têm EffectSpec real
 * (Deploy, When Paired, Attack, Burst, Main, Action, Activate·Main).
 *
 * "Destroyed" é despachado por dois caminhos, sem sobreposição:
 * - No Damage Step (morte de batalha / Breach / combatTrigger letal): `actions.ts`
 *   chama `collectDestroyedInBattle` + `dispatchDestroyedTriggers` depois do
 *   Damage Step (docs/44) — `resolveDamageStep`/`combat.ts` nunca passam por aqui.
 * - FORA do Damage Step (docs/45): `dispatchTrigger` abaixo, depois de aplicar os
 *   eventos de CADA EffectSpec, chama `dispatchDestroyedFromEffect` — acha as
 *   Units que o efeito acabou de matar (`destroy`/`damageUnit` letal via
 *   `resolveEffectSpec` — ex. Close Combat 【Main】, Rewloola 【Deploy】) e dispara o
 *   【Destroyed】 de cada uma. Não-pausante resolve inline; pausante (Char's Zaku Ⅱ)
 *   vira `PendingDecision.abilityResolution`, e o loop de specs desta carta para.
 */

export interface DispatchOptions {
  /** grupos de alvo já resolvidos (por quem chama — UI/IA/roteiro de teste), repassados pro EffectContext */
  targets?: Record<string, string[]>;
  predicateResolver?: PredicateResolver;
  /** recursos escolhidos pra pagar `payResourceCost` da habilidade (ver EffectContext.costResourceIds). */
  costResourceIds?: string[];
  /** repassado ao 【Destroyed】 fora de combate (docs/45) — filtro de alvo de um 【Destroyed】 direcionado (ex. GD01-056). */
  targetFilterResolver?: TargetFilterResolver;
  /**
   * docs/45 — lista COMPLETA de EffectSpecs (não a `specs` filtrada que este
   * `dispatchTrigger` recebe): usada pra achar o 【Destroyed】 de Units mortas
   * por dano/destroy direto do efeito que acabou de resolver. Ausente = usa
   * `specs` (só cobre 【Destroyed】 da própria carta fonte).
   */
  allSpecs?: EffectSpec[];
  /** docs/debates 2026-09-12/13 — profundidade da cascata de gatilhos (guarda anti-loop, ver `MAX_CASCADE_DEPTH` em abilityDispatch.ts). */
  cascadeDepth?: number;
  /** orçamento COMPARTILHADO de largura da fila de gatilhos numa única ação (ver `MAX_QUEUE_BREADTH`). */
  queueBudget?: TriggerQueueBudget;
}

/** Acha os EffectSpec de uma carta pra um trigger específico (ex.: "Deploy", "Burst", "Attack"). */
/**
 * W5 — índice (código, gatilho) → specs por array de specs: a varredura linear de ~700 specs a cada
 * consulta pesava no bot (MCTS) depois que Command jogado / custo pago passaram a consultar reações.
 * Reconstruído se o array mudar de tamanho; devolve cópia (quem chama pode ordenar/filtrar).
 */
const triggerIndex = new WeakMap<EffectSpec[], { size: number; byKey: Map<string, EffectSpec[]> }>();

export function findTriggerSpecs(specs: EffectSpec[], cardCode: string, trigger: string): EffectSpec[] {
  let index = triggerIndex.get(specs);
  if (!index || index.size !== specs.length) {
    const byKey = new Map<string, EffectSpec[]>();
    for (const s of specs) {
      const key = `${s.cardCode}\u0000${s.trigger}`;
      const list = byKey.get(key);
      if (list) list.push(s);
      else byKey.set(key, [s]);
    }
    index = { size: specs.length, byKey };
    triggerIndex.set(specs, index);
  }
  return [...(index.byKey.get(`${cardCode}\u0000${trigger}`) ?? [])];
}

/** W5 — eventos de reação que algum spec de `specs` escuta (mesmo cache por array) */
const reactionEventIndex = new WeakMap<EffectSpec[], { size: number; events: Set<string> }>();

export function specsListenTo(specs: EffectSpec[], event: string): boolean {
  let index = reactionEventIndex.get(specs);
  if (!index || index.size !== specs.length) {
    const events = new Set<string>();
    for (const s of specs) if (s.reaction) events.add(s.reaction.event);
    index = { size: specs.length, events };
    reactionEventIndex.set(specs, index);
  }
  return index.events.has(event);
}

/**
 * Dispara todo EffectSpec de `sourceInstanceId` pro `trigger` dado, na ordem
 * em que aparecem em `specs`, aplicando os eventos de cada um antes de
 * resolver o próximo (spec seguinte já vê o estado atualizado). Respeita
 * 【Once per Turn】 genericamente: se `CardDef.oncePerTurn` e essa instância já
 * usou esse `trigger` neste turno (`usedKeywordsThisTurn`), pula sem erro —
 * mesma convenção já usada por `keywords.ts` pra `<Support N>`, só que agora
 * automática pra qualquer trigger, não só keyword de motor (docs/18 já
 * registrava isso como "responsabilidade de quem despacha o efeito").
 */
/** marca de 【Once per Turn】 de um spec (W2a) — por gatilho, pra os specs de uma mesma cláusula dividida compartilharem */
export function specOncePerTurnMarker(spec: EffectSpec): string {
  return `oncePerTurn:${spec.trigger}`;
}

export function dispatchTrigger(
  state: GameState,
  sourceInstanceId: string,
  trigger: string,
  specs: EffectSpec[],
  opts: DispatchOptions = {},
): GameState {
  const source = findCard(state, sourceInstanceId);
  const matching = findTriggerSpecs(specs, source.def.code, trigger);
  const allSpecs = opts.allSpecs ?? specs;
  const cascadeDepth = opts.cascadeDepth ?? 0;
  const queueBudget = opts.queueBudget ?? { count: 0 };
  let next = state;
  /** 【Once per Turn】 dos specs que resolveram — marcados só no fim, pra cláusula dividida em 2 specs rodar inteira */
  const usedOncePerTurn = new Set<string>();

  const guardedEntry = checkTriggerLoopGuard(next, cascadeDepth, queueBudget);
  if (guardedEntry) return guardedEntry;

  for (const spec of matching) {
    queueBudget.count += 1;
    const guardedIter = checkTriggerLoopGuard(next, cascadeDepth, queueBudget);
    if (guardedIter) return guardedIter;

    const current = findCard(next, sourceInstanceId);
    if (current.def.oncePerTurn && current.usedKeywordsThisTurn.includes(trigger)) continue;
    if (spec.oncePerTurn && current.usedKeywordsThisTurn.includes(specOncePerTurnMarker(spec))) continue;
    if (!specPairGateOpen(next, current, spec)) continue;

    const ctx: EffectContext = {
      state: next,
      controller: current.owner,
      sourceInstanceId,
      turnNumber: next.turnNumber,
      targets: opts.targets ?? {},
      costResourceIds: opts.costResourceIds,
    };
    const before = next;
    const events = resolveEffectSpec(spec, ctx, opts.predicateResolver);
    next = applyEvents(next, events);
    // 【Once per Turn】: o uso é a ativação em si — marca ANTES das cascatas (Destroyed, reações,
    // pareamento), que podem pausar pra decisão e sair do loop sem voltar aqui.
    if (current.def.oncePerTurn) {
      next = applyEvent(next, { type: "MARK_KEYWORD_USED", instanceId: sourceInstanceId, keyword: trigger });
    }
    if (spec.oncePerTurn) usedOncePerTurn.add(specOncePerTurnMarker(spec));

    // docs/45 — 【Destroyed】 FORA do Damage Step: Units que este efeito acabou
    // de matar por dano/destroy direto (Close Combat 【Main】, Rewloola 【Deploy】,
    // GD01-044 Kshatriya 【When Paired】…) disparam seu 【Destroyed】 agora. O
    // Damage Step tem caminho próprio (actions.ts) e não passa por aqui. Sem
    // gate de profundidade aqui: `dispatchDestroyedTriggers` já checa o guard
    // no próprio topo (docs/debates 2026-09-13 — um só ponto de verdade).
    next = dispatchDestroyedFromEffect(before, next, allSpecs, {
      effectSource: {
        controller: current.owner,
        sourceId: sourceInstanceId,
        damagedIds: events.flatMap((e) => (e.type === "DAMAGE_UNIT" || e.type === "DAMAGE_BASE" ? [e.instanceId] : [])),
      },
      predicateResolver: opts.predicateResolver,
      targetFilterResolver: opts.targetFilterResolver,
      cascadeDepth: cascadeDepth + 1,
      queueBudget,
    });
    if (next.gameOver) break; // guard estourou dentro da cascata de Destroyed

    // W2a (C1) — "when this Unit receives effect damage / is rested by an effect…"
    next = dispatchReactionsFromEffect(before, next, events, current.owner, allSpecs, {
      sourceInstanceId,
      predicateResolver: opts.predicateResolver,
      targetFilterResolver: opts.targetFilterResolver,
      cascadeDepth: cascadeDepth + 1,
      queueBudget,
    });
    if (next.gameOver || next.pendingDecision.A || next.pendingDecision.B) break;
    // W5 (C6) — "when you pay ① or more for one of your Units' effects"
    const paidOcc = paidForUnitEffectOccurrence(before, sourceInstanceId, resourcePaymentAmount(before, events, current.owner));
    if (paidOcc) {
      next = dispatchReactions(next, [paidOcc], allSpecs, {
        predicateResolver: opts.predicateResolver,
        targetFilterResolver: opts.targetFilterResolver,
        cascadeDepth: cascadeDepth + 1,
        queueBudget,
      });
      if (next.gameOver || next.pendingDecision.A || next.pendingDecision.B) break;
    }

    // Lote 5 (docs/debates 2026-09-13) — GD01-065: qualquer primitiva que pareou
    // (ex. `pairFromTrashSearch`, GD01-023) dispara "AnyPairing" pra Units reativas
    // do controller (mesmo mecanismo do 【Destroyed】 acima, mas escutando PAIR_CARDS).
    next = dispatchAnyPairingFromEffect(before, next, allSpecs, {
      predicateResolver: opts.predicateResolver,
      targetFilterResolver: opts.targetFilterResolver,
      cascadeDepth: cascadeDepth + 1,
      queueBudget,
    });
    if (next.gameOver) break;
    // AnyPairing pausou: o 【When Paired】/【When Linked】 do pareamento espera na fila da decisão
    if (next.pendingDecision[current.owner]) {
      next = attachQueuedTriggers(next, pairingTriggerEntries(before, next));
      break;
    }
    // E6 — e o 【When Paired】/【When Linked】 das próprias cartas pareadas
    next = dispatchPairingTriggersFromEffect(before, next, allSpecs, {
      predicateResolver: opts.predicateResolver,
      targetFilterResolver: opts.targetFilterResolver,
      cascadeDepth: cascadeDepth + 1,
      queueBudget,
    });
    if (next.gameOver || next.pendingDecision.A || next.pendingDecision.B) break;

    // 【Deploy】 de toda carta que ESTE efeito pôs em campo — `deployThisCard` (【Burst】 de Base, docs/47
    // Fase 4) e também Unit deployada do trash/mão por efeito (W6 — `deployFromTrashPayingCost`: ST09-001 →
    // ST09-006, GD02-110 → GD03-062/GD04-060 "If you deploy this Unit from your trash"; antes só o
    // `deployThisCard` encadeava e esses 【Deploy】 nunca disparavam numa partida). Mesmo
    // `deferOrDispatchAbilities` do `deployCard`: resolve o automático e PAUSA quando há escolha real.
    // Piloto pareado (inclusive Command-Piloto) não é "deploy" de Unit/Base — fica de fora.
    for (const owner of [current.owner, otherPlayer(current.owner)]) {
      if (next.pendingDecision.A || next.pendingDecision.B || next.gameOver) break;
      const wasInPlay = new Set([...before.players[owner].battleArea, ...before.players[owner].baseSection].map((c) => c.instanceId));
      const deployed = [...next.players[owner].battleArea, ...next.players[owner].baseSection]
        .filter((c) => !wasInPlay.has(c.instanceId) && !c.pairedUnitId && (c.def.cardType === "UNIT" || c.def.cardType === "BASE"))
        .filter((c) => findTriggerSpecs(allSpecs, c.def.code, "Deploy").length > 0)
        .map((c) => ({ code: c.def.code, instanceId: c.instanceId }));
      if (deployed.length === 0) continue;
      // Encadeamento efeito→Deploy: profundidade de cascata incrementa (docs/debates 2026-09-13 §1.1)
      next = deferOrDispatchAbilities(next, owner, "Deploy", deployed, allSpecs, {
        predicateResolver: opts.predicateResolver,
        targetFilterResolver: opts.targetFilterResolver,
        cascadeDepth: cascadeDepth + 1,
        queueBudget,
      });
    }

    // W7 (C9) — continuações: o modo escolhido ("choose 1 of the following effects") e o "If you do, choose …"
    // (`thenTrigger`) rodam como gatilho próprio da mesma carta (`Mode:<n>`/`Then:<n>`), pelo caminho que pausa
    // quando pedem alvo/escolha. A decisão da continuação lembra a habilidade de origem (`parentTrigger`).
    const activeCalls = specActiveCalls(spec, ctx, opts.predicateResolver);
    const modeCall = activeCalls.find((c): c is Extract<PrimitiveCall, { op: "chooseMode" }> => c.op === "chooseMode");
    const chosenMode = modeCall ? (opts.targets?.[modeCall.key]?.[0] ?? modeCall.options[0]?.value) : undefined;
    const followUps: Array<{
      trigger: string;
      targets?: Record<string, string[]>;
      decidedBy?: "controller" | "opponent";
      /** outra carta como fonte (o 【Main】 da carta pareada, `activateMainOf`) */
      source?: { code: string; instanceId: string };
    }> = [];
    if (modeCall && chosenMode) {
      // alvo do modo já pronto só no caminho síncrono (bot/teste passa `targets.target` junto do modo); vindo da
      // fila de decisão só há a escolha do modo, e o modo pausa pra pedir o próprio alvo
      const { [modeCall.key]: _mode, ...modeTargets } = opts.targets ?? {};
      followUps.push({
        trigger: `Mode:${chosenMode}`,
        targets: Object.keys(modeTargets).length > 0 ? modeTargets : undefined,
        decidedBy: modeCall.options.find((o) => o.value === chosenMode)?.decidedBy,
      });
    }
    for (const call of activeCalls) {
      if (call.op === "thenTrigger") followUps.push({ trigger: call.trigger, decidedBy: call.decidedBy });
      if (call.op === "activateMainOf") {
        for (const id of resolveCallTargetIds(call.card, ctx)) {
          const card = findCard(next, id);
          if (card.def.cardType !== "COMMAND" || findTriggerSpecs(allSpecs, card.def.code, "Main").length === 0) continue;
          followUps.push({ trigger: "Main", source: { code: card.def.code, instanceId: id } });
        }
      }
    }
    for (const followUp of followUps) {
      if (next.gameOver) break;
      // o alvo do passo anterior segue como alvo implícito `previousTarget` ("…whose Lv. is equal to or lower than the
      // Unit rested with this ability", GD03-113)
      const previousTarget = ctx.targets.target?.length ? { previousTarget: ctx.targets.target } : undefined;
      const followUpSources = [
        followUp.source ? { ...followUp.source } : { code: current.def.code, instanceId: sourceInstanceId, implicitTargets: previousTarget },
      ];
      // rulings Q376/Q397 — ativar o 【Main】 de uma Command conta como "ativou o 【Main】" (GD05-068/089)
      if (followUp.source) next = markCommandTraitsActivated(next, followUp.source.instanceId);
      // algo do próprio efeito pausou antes (ex. 【Destroyed】 da Unit que ele destruiu): a continuação espera na fila
      if (next.pendingDecision.A || next.pendingDecision.B) {
        next = attachQueuedTriggers(next, [
          {
            owner: current.owner,
            trigger: followUp.trigger,
            sources: followUpSources,
            decider: followUp.decidedBy === "opponent" ? otherPlayer(current.owner) : undefined,
          },
        ]);
        continue;
      }
      next = deferOrDispatchAbilities(next, current.owner, followUp.trigger, followUpSources, allSpecs, {
        targets: followUp.targets,
        predicateResolver: opts.predicateResolver,
        targetFilterResolver: opts.targetFilterResolver,
        cascadeDepth: cascadeDepth + 1,
        queueBudget,
        decider: followUp.decidedBy === "opponent" ? otherPlayer(current.owner) : undefined,
      });
      if (!isFollowUpTrigger(trigger)) next = withParentTrigger(next, followUp.trigger, trigger);
    }

    // W7 — escudo destruído por EFEITO (GD05-107/033) também oferece o 【Burst】 ao dono (CR 13-2-5-1). No Damage
    // Step o combate tem caminho próprio; aqui só fora dele e sem decisão pendente desse jogador.
    if (!next.gameOver && next.combat?.step !== "damage") next = offerBurstForShieldsDestroyedByEffect(before, next, allSpecs);

    // 【Destroyed】 que PAUSA (Char's Zaku Ⅱ fora de combate) trava o resto do
    // loop de specs desta carta — a decisão pendente resolve antes de seguir.
    // `gameOver` cobre o guard anti-loop estourando em qualquer ponto acima.
    if (next.gameOver || next.pendingDecision[current.owner] || next.pendingDecision[otherPlayer(current.owner)]) break;
  }

  for (const keyword of usedOncePerTurn) {
    next = applyEvent(next, { type: "MARK_KEYWORD_USED", instanceId: sourceInstanceId, keyword });
  }
  return next;
}

/**
 * Decide se ativa o 【Burst】 de uma shield revelada. `false` = não ativa
 * (carta fica no trash). Um objeto (mesmo `{}`) = ativa, usando esse objeto
 * como `targets` do `EffectContext` — a maioria dos Burst é "self" e não
 * precisa de nenhum (`{}` serve), mas alguns (ex. `UNFORESEEN_INCIDENT_BURST`,
 * que ativa a seção 【Main】 da própria carta) precisam de alvo escolhido, daí
 * o `chooseBurst` já devolver o `targets` certo em vez de só um booleano.
 */
export type BurstChoiceFn = (card: CardInstance, specs: EffectSpec[]) => false | Record<string, string[]>;

/**
 * Pós-processamento do Damage Step (Comprehensive Rules — Shield destruída
 * por dano de batalha pode ter seu 【Burst】 ativado, por escolha de quem
 * defende). `combat.ts` continua puro e não sabe nada de Burst — ele só
 * manda a shield direto pro trash (`DAMAGE_SHIELD`/`shieldDamageEvents`).
 * Esta função compara o estado antes/depois de um passo de dano, acha as
 * shields que acabaram de virar trash (mesmo instanceId presente em
 * `before.shields` e agora em `after.trash`) e, pra cada uma com `hasBurst`
 * e EffectSpec cadastrado, oferece a chance de ativar via `chooseBurst`. Se
 * ativado, o próprio EffectSpec de Burst é responsável por realocar a carta
 * pra fora do trash (ex.: `moveZone self -> hand`, como já em
 * `AMURO_RAY_BURST`) — se ele não mover, a carta continua no trash (mesmo
 * resultado de não ter ativado).
 */
/**
 * Versão "pura, sem escolha" de `dispatchBurstForNewlyTrashedShields`: só
 * diz QUAIS shields recém-trashadas de `defendingPlayer` têm 【Burst】 real
 * (flag `hasBurst` + EffectSpec de trigger "Burst" cadastrado). O
 * `actions.ts` usa isso pra decidir se PAUSA o Damage Step e pede a decisão
 * de Burst ao defensor (docs/19, Sessão 2 — "Pausa Autoritativa de Burst"),
 * em vez de resolver na hora com um `chooseBurst` fixo.
 */
export function burstEligibleShieldIds(
  before: GameState,
  after: GameState,
  defendingPlayer: PlayerId,
  specs: EffectSpec[],
): string[] {
  const wasInShields = new Set(before.players[defendingPlayer].shields.map((c) => c.instanceId));
  return after.players[defendingPlayer].trash
    .filter((c) => wasInShields.has(c.instanceId))
    .filter((c) => c.def.hasBurst && findTriggerSpecs(specs, c.def.code, "Burst").length > 0)
    .map((c) => c.instanceId);
}

export function dispatchBurstForNewlyTrashedShields(
  before: GameState,
  after: GameState,
  defendingPlayer: PlayerId,
  specs: EffectSpec[],
  chooseBurst: BurstChoiceFn = () => false,
  predicateResolver?: PredicateResolver,
  targetFilterResolver?: TargetFilterResolver,
): GameState {
  const wasInShields = new Set(before.players[defendingPlayer].shields.map((c) => c.instanceId));
  const newlyTrashed = after.players[defendingPlayer].trash.filter((c) => wasInShields.has(c.instanceId));

  let next = after;
  for (const card of newlyTrashed) {
    if (!card.def.hasBurst) continue;
    const matching = findTriggerSpecs(specs, card.def.code, "Burst");
    if (matching.length === 0) continue;
    const targets = chooseBurst(card, matching);
    if (targets === false) continue;
    next = dispatchTrigger(next, card.instanceId, "Burst", specs, {
      targets,
      predicateResolver,
      targetFilterResolver,
      allSpecs: specs,
    });
  }
  return next;
}

/** W7 (C9) — marca a origem na decisão da continuação que acabou de pausar (a retomada do fluxo segue a origem) */
function withParentTrigger(state: GameState, followUpTrigger: string, parentTrigger: string): GameState {
  for (const p of ["A", "B"] as PlayerId[]) {
    const d = state.pendingDecision[p];
    if (d?.kind === "abilityResolution" && d.trigger === followUpTrigger && !d.parentTrigger) {
      return { ...state, pendingDecision: { ...state.pendingDecision, [p]: { ...d, parentTrigger } } };
    }
  }
  return state;
}

/** W7 — fila de 【Burst】 dos escudos que ESTE efeito destruiu (mesma decisão `burst` do Damage Step, sem 【Destroyed】 pendurado) */
function offerBurstForShieldsDestroyedByEffect(before: GameState, after: GameState, specs: EffectSpec[]): GameState {
  let next = after;
  for (const p of ["A", "B"] as PlayerId[]) {
    if (next.pendingDecision[p]) continue;
    const [first, ...rest] = burstEligibleShieldIds(before, next, p, specs);
    if (!first) continue;
    next = applyEvent(next, {
      type: "SET_PENDING_DECISION",
      player: p,
      decision: { kind: "burst", cardInstanceId: first, cardDef: findCard(next, first).def, choices: [], queuedInstanceIds: rest, pendingDestroyed: [] },
    });
  }
  return next;
}
