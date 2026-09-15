import type { CardInstance, GameState, PlayerId } from "./types";
import { otherPlayer } from "./types";
import type { EffectContext, EffectSpec, PredicateResolver, TargetFilterResolver } from "./effectSpec";
import { resolveEffectSpec } from "./effectSpec";
import { applyEvent, applyEvents, findCard } from "./events";
import { checkTriggerLoopGuard, deferOrDispatchAbilities, dispatchAnyPairingFromEffect, dispatchDestroyedFromEffect } from "./abilityDispatch";
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
export function findTriggerSpecs(specs: EffectSpec[], cardCode: string, trigger: string): EffectSpec[] {
  return specs.filter((s) => s.cardCode === cardCode && s.trigger === trigger);
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

  const guardedEntry = checkTriggerLoopGuard(next, cascadeDepth, queueBudget);
  if (guardedEntry) return guardedEntry;

  for (const spec of matching) {
    queueBudget.count += 1;
    const guardedIter = checkTriggerLoopGuard(next, cascadeDepth, queueBudget);
    if (guardedIter) return guardedIter;

    const current = findCard(next, sourceInstanceId);
    if (current.def.oncePerTurn && current.usedKeywordsThisTurn.includes(trigger)) continue;

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

    // docs/45 — 【Destroyed】 FORA do Damage Step: Units que este efeito acabou
    // de matar por dano/destroy direto (Close Combat 【Main】, Rewloola 【Deploy】,
    // GD01-044 Kshatriya 【When Paired】…) disparam seu 【Destroyed】 agora. O
    // Damage Step tem caminho próprio (actions.ts) e não passa por aqui. Sem
    // gate de profundidade aqui: `dispatchDestroyedTriggers` já checa o guard
    // no próprio topo (docs/debates 2026-09-13 — um só ponto de verdade).
    next = dispatchDestroyedFromEffect(before, next, allSpecs, {
      predicateResolver: opts.predicateResolver,
      targetFilterResolver: opts.targetFilterResolver,
      cascadeDepth: cascadeDepth + 1,
      queueBudget,
    });
    if (next.gameOver) break; // guard estourou dentro da cascata de Destroyed

    // Lote 5 (docs/debates 2026-09-13) — GD01-065: qualquer primitiva que pareou
    // (ex. `pairFromTrashSearch`, GD01-023) dispara "AnyPairing" pra Units reativas
    // do controller (mesmo mecanismo do 【Destroyed】 acima, mas escutando PAIR_CARDS).
    next = dispatchAnyPairingFromEffect(before, next, allSpecs, {
      predicateResolver: opts.predicateResolver,
      targetFilterResolver: opts.targetFilterResolver,
      cascadeDepth: cascadeDepth + 1,
      queueBudget,
    });
    if (next.gameOver || next.pendingDecision[current.owner]) break;

    // docs/47 Fase 4 — 【Burst】Deploy this card: a `deployThisCard` acabou de pôr
    // a carta em campo; agora encadeia o 【Deploy】 dela (Add 1 Shield / token /
    // dano / reordenar deck). Antes disso chamava `dispatchTrigger` direto com
    // auto-mira de um único alvo nomeado — sem suporte a `ChoicePrimitive`
    // (deckReorder, discardNamed, etc.), gap fechado usando o MESMO
    // `deferOrDispatchAbilities` que `deployCard`/`playCommand` usam pro Deploy
    // por jogada normal: resolve specs automáticos inline e PAUSA (mesmo
    // `PendingDecision.abilityResolution` de sempre) quando algum precisa de
    // escolha real — ex. ST02-015 Saint Gabriel "look at top 2, return 1 to
    // top e 1 to bottom" via Burst (deferred.ts Classe A, fechada).
    if (!next.pendingDecision[current.owner] && spec.actions.some((c) => c.op === "deployThisCard")) {
      const deployTriggerSpecs = findTriggerSpecs(allSpecs, current.def.code, "Deploy");
      if (deployTriggerSpecs.length > 0) {
        // Encadeamento Burst→Deploy: profundidade de cascata incrementa aqui
        // também (antes ficava parada em `chainDepth`, um dos 2 gaps que
        // deixavam o guard anterior incompleto — docs/debates 2026-09-13 §1.1).
        next = deferOrDispatchAbilities(next, current.owner, "Deploy", [{ code: current.def.code, instanceId: current.instanceId }], allSpecs, {
          predicateResolver: opts.predicateResolver,
          targetFilterResolver: opts.targetFilterResolver,
          cascadeDepth: cascadeDepth + 1,
          queueBudget,
        });
      }
    }

    if (current.def.oncePerTurn) {
      next = applyEvent(next, { type: "MARK_KEYWORD_USED", instanceId: sourceInstanceId, keyword: trigger });
    }

    // 【Destroyed】 que PAUSA (Char's Zaku Ⅱ fora de combate) trava o resto do
    // loop de specs desta carta — a decisão pendente resolve antes de seguir.
    // `gameOver` cobre o guard anti-loop estourando em qualquer ponto acima.
    if (next.gameOver || next.pendingDecision[current.owner] || next.pendingDecision[otherPlayer(current.owner)]) break;
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
