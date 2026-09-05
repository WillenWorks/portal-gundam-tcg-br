import type { CardInstance, GameState, PlayerId } from "./types";
import type { EffectContext, EffectSpec, PredicateResolver } from "./effectSpec";
import { resolveEffectSpec } from "./effectSpec";
import { applyEvent, applyEvents, findCard } from "./events";

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
 * "Destroyed" (ST03-006 Char's Zaku Ⅱ, ST04-009 Miguel's Ginn) É despachado —
 * mas pelo motor de COMBATE, não por aqui: `actions.ts` chama
 * `collectDestroyedInBattle` + `dispatchDestroyedTriggers` (abilityDispatch.ts)
 * depois do Damage Step (docs/44). `dispatchTrigger` abaixo continua genérico
 * e é o que aquele helper usa pro caso não-pausante. PENDENTE: destruição FORA
 * de combate (`destroy`/`damageUnit` letal via `resolveEffectSpec` — ex. Close
 * Combat 【Main】 matando uma HP1) ainda não dispara 【Destroyed】.
 */

export interface DispatchOptions {
  /** grupos de alvo já resolvidos (por quem chama — UI/IA/roteiro de teste), repassados pro EffectContext */
  targets?: Record<string, string[]>;
  predicateResolver?: PredicateResolver;
  /** recursos escolhidos pra pagar `payResourceCost` da habilidade (ver EffectContext.costResourceIds). */
  costResourceIds?: string[];
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
  let next = state;

  for (const spec of matching) {
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
    const events = resolveEffectSpec(spec, ctx, opts.predicateResolver);
    next = applyEvents(next, events);

    if (current.def.oncePerTurn) {
      next = applyEvent(next, { type: "MARK_KEYWORD_USED", instanceId: sourceInstanceId, keyword: trigger });
    }
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
    next = dispatchTrigger(next, card.instanceId, "Burst", specs, { targets, predicateResolver });
  }
  return next;
}
