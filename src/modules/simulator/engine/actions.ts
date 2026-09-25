import type { AttackTarget, DestroyedInBattle, GameState, PendingCombatTriggerChoice, PlayerId } from "./types";
import { isHiddenCard, type ViewGameState } from "./viewState";
import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "./effectSpec";
import { applyEvent, applyEvents, findCard } from "./events";
import { canPayLevel, deployCard, playCommand } from "./deploy";
import { costRestsSelf, specResourceCost } from "./costs";
import { declareAttack, proceedToBlockStep, activateBlocker, skipBlock, passAction, resolveDamageStep, resolveBattleEndStep } from "./combat";
import { advanceToMainPhase, beginEndPhaseActionStep, finishEndPhaseAndAdvance, passEndPhaseAction } from "./phases";
import { burstEligibleShieldIds, dispatchTrigger, findTriggerSpecs } from "./dispatcher";
import {
  collectDestroyedInBattle,
  deferOrDispatchAbilities,
  dispatchDestroyedFromEffect,
  dispatchDestroyedTriggers,
  filterDispatchableSpecs,
} from "./abilityDispatch";
import { activateSupport } from "./keywords";
import { finishGameSetup, mulliganNonce, redrawMulliganHand } from "./setup";
import { createRng } from "./rng";
import { effectiveCost, effectiveHp, hasKeyword, otherPlayer, pairedPilotFollowEvents } from "./types";

/**
 * Passo 4 (docs/18, "UI mínima de sandbox" + decisão do Willen de testar com
 * 2 abas reais): uma única ação de jogador vira uma requisição de rede
 * (HTTP), não uma chamada de função direta como nos testes. Este arquivo é a
 * "borda" do motor puro pro mundo com rede: agrupa toda ação que um jogador
 * pode declarar num único tipo serializável (`PlayerAction`) e um único
 * reducer (`applyPlayerAction`) que sabe pra qual função do motor cada uma
 * mapeia — o `server/matchStore.ts` (Node, com estado) chama isso, nunca as
 * funções do motor direto, pra ter só 1 lugar checando autorização.
 *
 * Autorização: funções do motor como `deployCard`/`playCommand`/`passAction`
 * já recebem um `player` e se autovalidam (dono da carta, jogador ativo,
 * prioridade do Action Step). As que NÃO recebem `player` explícito
 * (`declareAttack`, `activateBlocker`, `skipBlock`) são checadas aqui antes
 * de chamar — sem isso, a sessão do jogador B poderia declarar ataque com
 * uma Unit do jogador A só sabendo o `instanceId` dela.
 *
 * Auto-encadeamento: alguns passos do motor não são decisão nenhuma, só
 * avanço de estado (Attack Step -> Block Step ao declarar ataque; Action
 * Step -> Damage Step -> Battle End assim que os dois passam de combate;
 * Action Step da End Phase -> Repair/descarte/troca de turno assim que os
 * dois passam de fim de turno) — pra não obrigar o cliente a fazer 3-4
 * requisições HTTP pra 1 ataque (ou pra 1 fim de turno), essa borda já
 * encadeia isso, do mesmo jeito que `runAttack()` já fazia em
 * `st01VsSt02Match.test.ts`.
 *
 * docs/19, Sessão 2 — decisões interativas: 【Burst】 de shield quebrada
 * agora PAUSA o Damage Step e vira uma `PendingDecision` do defensor
 * (`GameState.pendingDecision`), resolvida por `resolveBurstDecision`
 * (ativar/recusar) em vez do `chooseBurst` fixo `() => false` de antes.
 * Habilidades ativadas (【Activate·Main】 de Tallgeese/White Base/Asticassia,
 * `<Support N>`) têm `activateAbility`. `resolveTriggerOrder` existe pro
 * caso de gatilhos simultâneos, mas nenhum EffectSpec de ST01/ST02 dispara
 * 2 triggers de cartas diferentes no mesmo evento ainda, então o motor
 * nunca chega a emitir esse `PendingDecision` na prática (o tipo está
 * pronto pra quando um card assim entrar).
 */
export type PlayerAction =
  | {
      kind: "deployCard";
      cardInstanceId: string;
      resourceInstanceIds?: string[];
      pairWithUnitId?: string;
      sacrificeInstanceId?: string;
      targets?: Record<string, string[]>;
    }
  | {
      kind: "playCommand";
      cardInstanceId: string;
      trigger: "Main" | "Action";
      resourceInstanceIds?: string[];
      targets?: Record<string, string[]>;
    }
  | { kind: "declareAttack"; attackerId: string; target: AttackTarget }
  | { kind: "activateBlocker"; blockerId: string }
  | { kind: "skipBlock" }
  | { kind: "passAction" }
  | { kind: "finishTurn" }
  | { kind: "passEndPhaseAction" }
  /**
   * 【Activate·Main】 / `<Support N>` de uma carta em campo. Se a carta tem um
   * EffectSpec de trigger "Activate·Main", ele é despachado (com `targets`);
   * senão, se tiver `<Support>`, cai em `activateSupport()` (alvo em
   * `targets.target[0]`). `abilityIndex` reservado pra cartas com mais de
   * uma habilidade ativada (nenhuma de ST01/ST02 tem — default 0).
   */
  | {
      kind: "activateAbility";
      sourceInstanceId: string;
      abilityIndex?: number;
      targets?: Record<string, string[]>;
      /** recursos escolhidos pra pagar o custo `④`/`②` da habilidade (evita gastar o EX Resource). */
      resourceInstanceIds?: string[];
    }
  /** Resolve a `PendingDecision` de 【Burst】 do defensor (ver `passAction`). `activate: false` = manda a shield pro trash. */
  | { kind: "resolveBurstDecision"; activate: boolean; targets?: Record<string, string[]> }
  /** Resolve a `PendingDecision` de ordenação de gatilhos simultâneos (ordem em que os efeitos resolvem). */
  | { kind: "resolveTriggerOrder"; orderedSpecIds: string[] }
  /**
   * Resolve a `PendingDecision.abilityResolution` (gatilhos de 【When Paired】 /
   * 【Attack】 / … resolvidos num momento separado). A ORDEM do array é a ordem
   * escolhida pelo jogador. `activate: false` pula um efeito `optional`.
   * `targetIds` alimenta `ctx.targets.target`.
   */
  | {
      kind: "resolveAbility";
      /**
       * `secondaryTargetIds` (docs/47 Fase 5) — resposta pro `secondaryTarget`
       * da entrada da fila, se houver (ST05-010 Mikazuki Augus 【When Paired】).
       * Igual a `targetIds`: 0 ou 1 id, virando `ctx.targets[secondaryTarget.name]`.
       */
      resolutions: Array<{ specId: string; activate: boolean; targetIds: string[]; secondaryTargetIds?: string[] }>;
    }
  /**
   * Resolve a `PendingDecision.mulligan` de início de partida (Comprehensive
   * Rules 6-2 / ruling oficial). `keep: false` = troca a mão (mão inteira pro
   * fundo do deck, re-embaralha, compra 5). Sequencial: ao resolver o 1º
   * jogador o motor seta o mulligan do 2º; ao resolver o 2º, coloca os 6
   * shields de cada lado + EX Base + EX Resource e avança pra Main Phase.
   */
  | { kind: "resolveMulligan"; keep: boolean }
  /**
   * Resolve a `PendingDecision.zoneOverflow` (V2, docs/27 — Battle Area com
   * mais de 6 Units): `instanceId` é a Unit própria escolhida pra ir pro
   * trash (rules management, não é "destruída" — mesma regra da Base
   * excedente).
   */
  | { kind: "resolveZoneOverflow"; instanceId: string };

/**
 * Aplica uma `PlayerAction` declarada por `actingPlayer`. Lança erro (motivo
 * legível, igual ao resto do motor) se a ação for ilegal — quem chama decide
 * o que fazer com isso (a rota HTTP devolve 400 com a mensagem).
 *
 * V2 (docs/27): toda ação passa por `enforceZoneLimits` antes de voltar —
 * único ponto de checagem de rules management (limite de 6 Units na Battle
 * Area), igual este arquivo já é o único ponto de checagem de autorização
 * (ver docstring de `PlayerAction` acima). Cobre `deployCard` (jogar da mão)
 * E qualquer `EffectSpec` que use `spawnToken`/`spawnTokenByOwnUnitCount`
 * (White Base, Corsica Base) sem precisar de checagem própria em cada um.
 */
export function applyPlayerAction(
  state: GameState,
  actingPlayer: PlayerId,
  action: PlayerAction,
  specs: EffectSpec[],
  predicateResolver?: PredicateResolver,
  targetFilterResolver?: TargetFilterResolver,
): GameState {
  const result = applyPlayerActionInner(state, actingPlayer, action, specs, predicateResolver, targetFilterResolver);
  return enforceZoneLimits(enforceLethalDamage(result, specs, predicateResolver, targetFilterResolver));
}

/** destruir uma Unit pode derrubar o HP de outra (aura que some) — repete até estabilizar, com teto */
const MAX_LETHAL_PASSES = 8;

/**
 * CR 2-8-2 / 11-1-2 / 11-3-1 — rules management: card com HP restante zero é destruído na
 * hora, inclusive quando o HP caiu DEPOIS do dano (bônus "during this turn" que expirou, Link
 * desfeito, aura que sumiu). Dano de combate e de efeito já destroem no momento do dano; isto
 * é a rede pro que muda o HP sem dano novo. Só com o estado assentado — sem decisão pendente e
 * fora de combate (o Damage Step tem a ordem própria de destruição e 【Destroyed】).
 */
function enforceLethalDamage(
  state: GameState,
  specs: EffectSpec[],
  predicateResolver?: PredicateResolver,
  targetFilterResolver?: TargetFilterResolver,
): GameState {
  let next = state;
  for (let pass = 0; pass < MAX_LETHAL_PASSES; pass++) {
    if (next.gameOver || next.pendingDecision.A || next.pendingDecision.B || next.combat) return next;
    const current = next;
    const lethal = (["A", "B"] as PlayerId[]).flatMap((p) =>
      [...current.players[p].battleArea.filter((c) => c.def.cardType === "UNIT"), ...current.players[p].baseSection].filter(
        (c) => c.damage > 0 && c.damage >= effectiveHp(c, current),
      ),
    );
    if (lethal.length === 0) return next;
    const before = next;
    for (const card of lethal) {
      next = applyEvent(next, { type: "DESTROY_CARD", instanceId: card.instanceId });
      next = applyEvents(next, pairedPilotFollowEvents(card));
    }
    next = dispatchDestroyedFromEffect(before, next, specs, { predicateResolver, targetFilterResolver });
  }
  return next;
}

function applyPlayerActionInner(
  state: GameState,
  actingPlayer: PlayerId,
  action: PlayerAction,
  specs: EffectSpec[],
  predicateResolver?: PredicateResolver,
  targetFilterResolver?: TargetFilterResolver,
): GameState {
  // Decisão interativa pendente trava tudo (docs/19, Sessão 2): enquanto o
  // defensor não resolve o Burst (ou quem controla não ordena os gatilhos),
  // nenhuma outra ação — de nenhum dos dois — avança o estado.
  if (state.pendingDecision[otherPlayer(actingPlayer)]) {
    throw new Error("Aguardando o oponente resolver uma decisão pendente (Mulligan / Burst / ordem de gatilhos)");
  }
  const myPending = state.pendingDecision[actingPlayer];
  if (myPending) {
    if (myPending.kind === "burst" && action.kind !== "resolveBurstDecision") {
      throw new Error("Resolva a decisão de 【Burst】 pendente antes de qualquer outra ação");
    }
    if (myPending.kind === "triggerOrder" && action.kind !== "resolveTriggerOrder") {
      throw new Error("Ordene os gatilhos simultâneos pendentes antes de qualquer outra ação");
    }
    if (myPending.kind === "abilityResolution" && action.kind !== "resolveAbility") {
      throw new Error("Resolva o efeito de habilidade pendente antes de qualquer outra ação");
    }
    if (myPending.kind === "mulligan" && action.kind !== "resolveMulligan") {
      throw new Error("Decida seu Mulligan antes de qualquer outra ação");
    }
    if (myPending.kind === "zoneOverflow" && action.kind !== "resolveZoneOverflow") {
      throw new Error("Escolha qual Unit vai pro trash (Battle Area acima do limite de 6) antes de qualquer outra ação");
    }
  }

  switch (action.kind) {
    case "deployCard":
      return deployCard(state, actingPlayer, action.cardInstanceId, {
        resourceInstanceIds: action.resourceInstanceIds,
        pairWithUnitId: action.pairWithUnitId,
        sacrificeInstanceId: action.sacrificeInstanceId,
        specs,
        targets: action.targets,
        predicateResolver,
        targetFilterResolver,
      });

    case "playCommand":
      return playCommand(state, actingPlayer, action.cardInstanceId, action.trigger, specs, {
        resourceInstanceIds: action.resourceInstanceIds,
        targets: action.targets,
        predicateResolver,
        targetFilterResolver,
      });

    case "declareAttack": {
      const attacker = findCard(state, action.attackerId);
      if (attacker.owner !== actingPlayer) {
        throw new Error("Só é possível declarar ataque com uma Unit própria");
      }
      let next = declareAttack(state, action.attackerId, action.target);
      // 【Attack】 do atacante + do Piloto pareado (a habilidade do Pilot dispara
      // quando a Unit pareada ataca). Pausa se optativo/precisa de alvo (ex.:
      // ST01-011 Suletta — "Choose 1 of your Resources. Set it as active.").
      const pilotId = attacker.pairedPilotId;
      next = deferOrDispatchAbilities(
        next,
        actingPlayer,
        "Attack",
        [
          { code: attacker.def.code, instanceId: action.attackerId },
          ...(pilotId ? [{ code: findCard(next, pilotId).def.code, instanceId: pilotId }] : []),
        ],
        specs,
        { predicateResolver, targetFilterResolver },
      );
      if (next.pendingDecision[actingPlayer]) return next; // pausou pra escolher (segue no resolveAbility)
      // Attack Step -> Block Step não é decisão de ninguém, é avanço automático.
      return proceedToBlockStep(next);
    }

    case "activateBlocker": {
      const combat = state.combat;
      if (!combat) throw new Error("Nenhum combate em andamento");
      if (actingPlayer !== combat.defendingPlayer) {
        throw new Error("Só quem está defendendo pode ativar <Blocker>");
      }
      return activateBlocker(state, action.blockerId);
    }

    case "skipBlock": {
      const combat = state.combat;
      if (!combat) throw new Error("Nenhum combate em andamento");
      if (actingPlayer !== combat.defendingPlayer) {
        throw new Error("Só quem está defendendo pode decidir não bloquear");
      }
      return skipBlock(state);
    }

    case "passAction": {
      // passAction() já valida internamente que `actingPlayer` tem a prioridade
      // do Action Step agora (combat.actionPriority) — não precisa checar de novo aqui.
      let next = passAction(state, actingPlayer);
      if (next.combat?.step !== "damage") return next; // ainda falta o outro jogador passar

      const beforeDamage = next;
      next = resolveDamageStep(next);
      if (next.gameOver) return next; // GAME_OVER pode disparar dentro do próprio Damage Step

      // 【Destroyed】 (docs/44): Units que morreram neste Damage Step — capturado
      // ANTES de qualquer dispatch (o snapshot `beforeDamage` ainda tem o
      // `pairedPilotId`, que o 【During Pair】【Destroyed】 de Miguel's Ginn checa).
      const destroyed = collectDestroyedInBattle(beforeDamage, next);

      const defendingPlayer = beforeDamage.combat!.defendingPlayer;
      const burstIds = burstEligibleShieldIds(beforeDamage, next, defendingPlayer, specs);
      if (burstIds.length > 0) {
        // PAUSA autoritativa (docs/19, Sessão 2): combate fica parado no Damage
        // Step, o defensor decide via `resolveBurstDecision`. 【Burst】 primeiro,
        // 【Destroyed】 depois (ver `resolveBurstDecision`); o Battle End só roda
        // quando as duas filas esvaziam.
        return setPendingBurst(next, defendingPlayer, burstIds, destroyed);
      }

      next = dispatchDestroyedTriggers(next, destroyed, specs, { predicateResolver, targetFilterResolver });
      return finishDamageStep(next, actingPlayer);
    }

    case "finishTurn": {
      if (state.combat) throw new Error("Não é possível passar o turno durante um combate em andamento");
      if (state.phase !== "main") throw new Error("Só é possível passar o turno na Main Phase");
      if (state.activePlayer !== actingPlayer) throw new Error("Só o jogador ativo pode passar o turno");
      // Não encerra o turno direto: entra no Action Step da End Phase (Comprehensive
      // Rules 7-6), que dá a mesma chance de prioridade alternada que o Action Step
      // de uma batalha tem — só depois que os dois passarem (`passEndPhaseAction`
      // abaixo) é que Repair/descarte/troca de turno realmente rodam.
      return beginEndPhaseActionStep(state);
    }

    case "passEndPhaseAction": {
      // passEndPhaseAction() já valida internamente que `actingPlayer` tem a
      // prioridade do Action Step da End Phase agora — não precisa checar de novo aqui.
      const next = passEndPhaseAction(state, actingPlayer);
      if (next.endPhaseAction) return next; // ainda falta o outro jogador passar
      return finishEndPhaseAndAdvance(next);
    }

    case "activateAbility": {
      const source = findCard(state, action.sourceInstanceId);
      if (source.owner !== actingPlayer) throw new Error("Só dá pra ativar habilidade de uma carta própria");

      // 【Activate·Main】 (Main Phase, fora de combate) ou 【Activate·Action】 no
      // Action Step — de uma batalha OU da End Phase (Comprehensive Rules: os dois
      // Action Steps aceitam as mesmas jogadas, mesmo critério de `playCommand`).
      const inBattleActionStep = state.combat?.step === "action";
      const inEndPhaseActionStep = state.endPhaseAction !== null;
      const inActionStep = inBattleActionStep || inEndPhaseActionStep;
      const trigger = inActionStep ? "Activate·Action" : "Activate·Main";
      if (!inActionStep) {
        if (state.phase !== "main") throw new Error("【Activate·Main】 só pode ser ativado na Main Phase");
        if (state.combat) throw new Error("【Activate·Main】 não pode ser ativado durante um combate");
        if (state.activePlayer !== actingPlayer) throw new Error("Só o jogador ativo pode ativar 【Activate·Main】");
      } else {
        const priority = inBattleActionStep ? state.combat!.actionPriority : state.endPhaseAction!.priority;
        if (priority !== actingPlayer) throw new Error("Não é a prioridade desse jogador no Action Step");
      }

      const abilitySpecs = findTriggerSpecs(specs, source.def.code, trigger);
      if (abilitySpecs.length > 0) {
        // V0 (docs/25): mesma filtragem de `playCommand` — spec com alvo
        // ilegal/não escolhido lança, spec sem alvo legal nenhum sai do lote.
        // Achado (Sprint 2 Lote 11, revalidação GD02-011 Moebius): faltavam
        // `predicateResolver`/`sourceInstanceId` (últimos 2 params) — qualquer
        // spec de Activate cujo `targetScope`/`condition` dependa da FONTE (ex.
        // `battlingBaseOrShield`, `level<=self`, `selfIsDamaged` via `resolveSelfUnit`)
        // sempre computava pool vazia aqui e saía do lote em silêncio (sem
        // lançar — "spec sem alvo legal nenhum sai do lote" já cobria o
        // sintoma), mesmo com alvo legal de verdade no board.
        const dispatchable = filterDispatchableSpecs(
          state,
          source.def.code,
          trigger,
          specs,
          actingPlayer,
          action.targets?.target,
          targetFilterResolver,
          predicateResolver,
          action.sourceInstanceId,
        );
        return dispatchTrigger(state, action.sourceInstanceId, trigger, dispatchable, {
          targets: action.targets,
          costResourceIds: action.resourceInstanceIds,
          predicateResolver,
          targetFilterResolver,
          allSpecs: specs,
        });
      }

      // Sem EffectSpec de 【Activate·Main】 — cai em `<Support N>` (keyword de motor).
      // <Support> é 【Activate·Main】: nunca vale em Action Step (batalha ou End Phase).
      if (trigger === "Activate·Main" && hasKeyword(source, "Support", state)) {
        const supportTargetId = action.targets?.target?.[0];
        if (!supportTargetId) throw new Error("<Support> precisa de uma Unit amiga alvo (targets.target[0])");
        return activateSupport(state, action.sourceInstanceId, supportTargetId);
      }

      throw new Error(`${source.def.code} não tem ${trigger === "Activate·Main" ? "【Activate·Main】 nem <Support>" : "【Activate·Action】"} pra ativar`);
    }

    case "resolveBurstDecision": {
      const decision = state.pendingDecision[actingPlayer];
      if (!decision || decision.kind !== "burst") {
        throw new Error("Não há decisão de 【Burst】 pendente pra esse jogador");
      }
      let next = applyEvent(state, { type: "CLEAR_PENDING_DECISION", player: actingPlayer });
      if (action.activate) {
        // V0 (docs/25): alguns 【Burst】 reaproveitam a ação do 【Main】 da mesma
        // carta (ex.: Siege Ploy, Unforeseen Incident) e por isso também podem
        // precisar de alvo nomeado — mesma filtragem de `playCommand`. Mesmo
        // fix de `sourceInstanceId`/`predicateResolver` do `activateAbility`
        // acima (Sprint 2 Lote 11) — sem isso, um Burst cujo alvo dependa da
        // fonte (ex. `level<=self`) também sairia do lote em silêncio.
        const dispatchable = filterDispatchableSpecs(
          next,
          decision.cardDef.code,
          "Burst",
          specs,
          actingPlayer,
          action.targets?.target,
          targetFilterResolver,
          predicateResolver,
          decision.cardInstanceId,
        );
        next = dispatchTrigger(next, decision.cardInstanceId, "Burst", dispatchable, {
          targets: action.targets ?? {},
          predicateResolver,
          targetFilterResolver,
          allSpecs: specs,
        });
      }
      if (decision.queuedInstanceIds.length > 0) {
        return setPendingBurst(next, actingPlayer, decision.queuedInstanceIds, decision.pendingDestroyed ?? []);
      }
      // Fila de 【Burst】 esvaziou: agora os 【Destroyed】 do MESMO Damage Step
      // (docs/44) — não-pausantes inline, pausante (Char's Zaku Ⅱ) vira
      // `abilityResolution` resolvida antes do Battle End (que agora também
      // checa `combat.pendingTriggerChoices` — docs/47 Fase 6).
      if (!next.gameOver && next.combat?.step === "damage") {
        next = dispatchDestroyedTriggers(next, decision.pendingDestroyed ?? [], specs, {
          predicateResolver,
          targetFilterResolver,
        });
        next = finishDamageStep(next, actingPlayer);
      }
      return next;
    }

    case "resolveTriggerOrder": {
      const decision = state.pendingDecision[actingPlayer];
      if (!decision || decision.kind !== "triggerOrder") {
        throw new Error("Não há gatilhos simultâneos pendentes pra ordenar");
      }
      const pending = [...decision.triggers.map((t) => t.specId)].sort();
      const given = [...action.orderedSpecIds].sort();
      if (pending.length !== given.length || pending.some((id, i) => id !== given[i])) {
        throw new Error("A ordem precisa listar exatamente os gatilhos pendentes, sem repetir nem faltar");
      }
      let next = applyEvent(state, { type: "CLEAR_PENDING_DECISION", player: actingPlayer });
      for (const specId of action.orderedSpecIds) {
        const trig = decision.triggers.find((t) => t.specId === specId)!;
        // filtra `specs` pro spec exato — dispatchTrigger roda todos os specs de
        // (cardCode, trigger); aqui a gente já sabe qual é a ordem escolhida.
        // NOTA (V0, docs/25): este caminho não passa pela filtragem de alvo —
        // gatilhos simultâneos (2+ cards no MESMO evento) não têm nenhum spec
        // com alvo nomeado hoje em ST01/ST02 (confirmado nos testes), então
        // nunca dispara na prática. Fica registrado: se uma carta futura
        // precisar de alvo AQUI, aplicar o mesmo `filterDispatchableSpecs`
        // usado em `playCommand`/`activateAbility`/`resolveBurstDecision`.
        next = dispatchTrigger(next, trig.instanceId, trig.trigger, specs.filter((s) => s.id === specId), {
          predicateResolver,
          targetFilterResolver,
          allSpecs: specs,
        });
      }
      return next;
    }

    case "resolveAbility": {
      const decision = state.pendingDecision[actingPlayer];
      if (!decision || decision.kind !== "abilityResolution") {
        throw new Error("Não há efeito de habilidade pendente pra resolver");
      }
      const queueIds = [...decision.queue.map((q) => q.specId)].sort();
      const givenIds = [...action.resolutions.map((r) => r.specId)].sort();
      if (queueIds.length !== givenIds.length || queueIds.some((id, i) => id !== givenIds[i])) {
        throw new Error("As resoluções precisam listar exatamente os efeitos pendentes");
      }
      let next = applyEvent(state, { type: "CLEAR_PENDING_DECISION", player: actingPlayer });
      // a ORDEM do array `resolutions` é a ordem escolhida pelo jogador.
      const commandSources = new Set<string>();
      for (const r of action.resolutions) {
        const q = decision.queue.find((x) => x.specId === r.specId)!;
        const deckReveal = q.deckTopReveal;
        const handChoice = q.handChoice;
        const handDiscard = q.handDiscard;
        const deckReorder = q.deckReorder;
        const enumChoice = q.enumChoice;
        const trashSearch = q.trashSearch;
        // docs/47 Fase 5 — 2º pool de alvo (ST05-010 Mikazuki Augus 【When Paired】).
        const secondaryIds = r.secondaryTargetIds ?? [];

        // "Não revelar" ainda dispara `lookAtTopFilterReveal` (as N cartas vão
        // pro fundo). `handDiscard`/`deckReorder`/`enumChoice` são MANDATÓRIOS
        // (não é "may") — não caem nos `continue` de skip; a validação abaixo
        // exige a escolha. `trashSearch` (GD01-067) é como `deckReveal` — "não
        // escolher" é um caminho legal (nada sai da lixeira, sem custo nenhum).
        // "you may discard …" recusado: pula antes das validações de escolha obrigatória (descarte /
        // reordenação / opção só são exigidos quando o efeito ativa). `deckTopReveal`/`trashSearch`
        // ficam de fora: "não revelar" ainda resolve o efeito (as cartas do topo vão pro fundo).
        if (q.optional && !r.activate && (handDiscard || deckReorder || enumChoice)) continue;
        if (!deckReveal && !handDiscard && !deckReorder && !enumChoice && !trashSearch) {
          // pulado, ou "Choose 1 ..." sem alvo/carta escolhida = nada acontece (regra oficial).
          if (!r.activate) continue;
          if (q.needsTarget && r.targetIds.length === 0) continue;
          if (handChoice && r.targetIds.length === 0) continue;
          // "Choose 1 X AND 1 Y" (ST05-010) — os 2 alvos são exigidos JUNTOS;
          // sem o 2º (nenhum legal, ou o jogador não escolheu), o efeito inteiro
          // não ativa, mesmo com o 1º já escolhido (senão `resolveTargetIds`
          // lança "alvo nomeado não foi resolvido" pro 2º ao compilar as actions).
          if (q.secondaryTarget && secondaryIds.length === 0) continue;
        }

        // V0 (docs/25): os candidatos legais foram calculados no servidor ao
        // montar a fila (`deferOrDispatchAbilities`) — nunca confia cegamente no
        // que o cliente manda de volta aqui.
        if (q.needsTarget && r.targetIds.length > 0 && !r.targetIds.every((id) => q.legalTargets.includes(id))) {
          throw new Error(`Alvo inválido pra ${r.specId} — não está entre os alvos legais.`);
        }
        // Lote 4 (docs/debates 2026-09-13) — "Choose 1 to 2"/"Choose 2 ...": nunca mais
        // que `max`, sem repetir. Não força um piso mínimo aqui (mesma leniência já
        // existente pra alvo singular — cliente pode sempre "declinar").
        if (q.targetCount && (r.targetIds.length > q.targetCount.max || new Set(r.targetIds).size !== r.targetIds.length)) {
          throw new Error(`Escolha de alvos inválida pra ${r.specId} — no máximo ${q.targetCount.max}, sem repetir.`);
        }
        if (handChoice && r.targetIds.length > 0 && !r.targetIds.every((id) => handChoice.legalHandIds.includes(id))) {
          throw new Error(`Carta inválida pra ${r.specId} — não está entre as cartas elegíveis da mão.`);
        }
        if (deckReveal && r.targetIds.length > 0 && !r.targetIds.every((id) => deckReveal.revealableIds.includes(id))) {
          throw new Error(`Carta inválida pra ${r.specId} — não está entre as cartas reveláveis do topo do deck.`);
        }
        if (handDiscard) {
          const want = Math.min(handDiscard.n, handDiscard.legalHandIds.length);
          if (r.targetIds.length !== want || !r.targetIds.every((id) => handDiscard.legalHandIds.includes(id))) {
            throw new Error(`Descarte inválido pra ${r.specId} — escolha ${want} carta(s) da mão.`);
          }
        }
        if (deckReorder) {
          const topIds = deckReorder.topCards.map((c) => c.instanceId);
          const want = Math.min(deckReorder.slots.length, topIds.length);
          if (r.targetIds.length !== want || new Set(r.targetIds).size !== r.targetIds.length || !r.targetIds.every((id) => topIds.includes(id))) {
            throw new Error(`Reordenação inválida pra ${r.specId} — atribua as ${want} carta(s) do topo, sem repetir.`);
          }
        }
        if (enumChoice) {
          const values = enumChoice.options.map((o) => o.value);
          if (r.targetIds.length !== 1 || !values.includes(r.targetIds[0])) {
            throw new Error(`Escolha inválida pra ${r.specId} — opções: ${values.join(" / ")}.`);
          }
        }
        if (trashSearch && r.targetIds.length > 0 && !r.targetIds.every((id) => trashSearch.legalTrashIds.includes(id))) {
          throw new Error(`Carta inválida pra ${r.specId} — não está entre as cartas elegíveis da lixeira.`);
        }
        if (q.secondaryTarget && secondaryIds.length > 0 && !secondaryIds.every((id) => q.secondaryTarget!.legalTargets.includes(id))) {
          throw new Error(`Alvo secundário inválido pra ${r.specId} — não está entre os alvos legais.`);
        }

        // Só `target` — NUNCA aliasar pra `shield`: um EffectSpec que combina
        // `addShieldToHand` + alvo nomeado (ex. ST03-015 Rewloola "Add 1 Shield
        // to hand. Then, choose 1 enemy Unit... deal 1 damage") teria a Unit
        // inimiga escolhida entrando como "qual shield adicionar", movendo a
        // Unit pra mão e nunca devolvendo o shield real. `addShieldToHand` cai
        // no fallback "primeiros N shields" (shield é face-down, a escolha não
        // carrega informação).
        const targets: Record<string, string[]> = { target: r.targetIds };
        if (handChoice) targets.deploy = r.targetIds;
        if (deckReveal) targets.reveal = r.targetIds;
        if (handDiscard) targets.discard = r.targetIds;
        if (deckReorder) deckReorder.slots.forEach((slot, i) => { targets[slot.name] = r.targetIds[i] ? [r.targetIds[i]] : []; });
        if (enumChoice) targets[enumChoice.key] = r.targetIds;
        if (trashSearch) targets.trashSearch = r.targetIds;
        if (q.secondaryTarget) targets[q.secondaryTarget.name] = secondaryIds;
        // Lote 5 (docs/debates 2026-09-13) — GD01-005: alvo(s) que o motor já
        // resolveu (ex. `formerPairedPilot`, ver `DestroyedInBattle.formerPairedPilotId`),
        // não escolhidos pelo jogador.
        if (q.implicitTargets) Object.assign(targets, q.implicitTargets);

        // docs/47 Fase 6 — entrada "crua" (sem EffectSpec correspondente):
        // `q.combatTrigger` vem de `CombatTrigger.action` (Sinanju/Akihiro
        // Altland), não de `specs` — compila o evento direto, sem `dispatchTrigger`.
        if (q.combatTrigger) {
          const chosenId = r.targetIds[0];
          if (chosenId) {
            if (q.combatTrigger.action.kind === "damageChosenEnemyUnit") {
              const amount = q.combatTrigger.action.amount;
              next = applyEvent(next, { type: "DAMAGE_UNIT", instanceId: chosenId, amount });
              const target = findCard(next, chosenId);
              if (target.damage >= effectiveHp(target, next)) {
                const beforeDestroy = next;
                next = applyEvent(next, { type: "DESTROY_CARD", instanceId: chosenId });
                next = applyEvents(next, pairedPilotFollowEvents(target));
                next = dispatchDestroyedFromEffect(beforeDestroy, next, specs, { predicateResolver, targetFilterResolver });
              }
            } else {
              // retrieveFromTrash — "Add it to your hand."
              next = applyEvent(next, { type: "MOVE_CARD", instanceId: chosenId, toZone: "hand" });
            }
          }
          continue;
        }

        if (decision.trigger === "Main" || decision.trigger === "Action") commandSources.add(q.sourceInstanceId);
        next = dispatchTrigger(next, q.sourceInstanceId, decision.trigger, specs.filter((s) => s.id === r.specId), {
          targets,
          predicateResolver,
          targetFilterResolver,
          allSpecs: specs,
        });
      }

      // Command 【Main】/【Action】 que pausou pra escolha (ST04-012 Striker Pack):
      // Comprehensive Rules 3-4-4 — a carta vai pro trash depois do efeito
      // resolver. `playCommand` faz isso no fluxo síncrono; aqui é o fluxo
      // pausado.
      for (const srcId of commandSources) {
        const src = next.players.A.hand.concat(next.players.B.hand).find((c) => c.instanceId === srcId);
        if (src && src.def.cardType === "COMMAND") {
          next = applyEvent(next, { type: "MOVE_CARD", instanceId: srcId, toZone: "trash" });
        }
      }
      // docs/45 — 【Destroyed】 cross-player enfileirado (efeito AoE que matou
      // Units-com-【Destroyed】-que-pausa dos dois lados): agora que a decisão do
      // jogador ativo fechou, dispara a do oponente (FIFO).
      if (decision.queuedDestroyed && !next.gameOver && !next.pendingDecision.A && !next.pendingDecision.B) {
        const qd = decision.queuedDestroyed;
        next = deferOrDispatchAbilities(next, qd.owner, "Destroyed", qd.sources, specs, {
          predicateResolver,
          targetFilterResolver,
        });
        if (next.pendingDecision.A || next.pendingDecision.B) return next;
      }
      // veio de 【Attack】: o combate estava parado no Attack Step -> segue pro Block Step.
      if (decision.trigger === "Attack" && !next.gameOver && next.combat?.step === "attack") {
        return proceedToBlockStep(next);
      }
      // veio de 【Destroyed】 (Char's Zaku Ⅱ, docs/44), 【Deploy】 encadeado por
      // 【Burst】 (docs/47 Fase 4 — ST02-015/ST03-015/GD01-129, achado por
      // fuzzing: `resolveBurstDecision` já tratava o caso sem pausa, faltava o
      // espelho aqui) ou escolha de gatilho de combate (docs/47 Fase 6 —
      // Sinanju/Akihiro Altland): o combate estava parado no Damage Step
      // esperando esta escolha -> `finishDamageStep` fecha o Battle End Step
      // (ou pausa de novo, se sobrou mais alguma coisa — Burst→Destroyed→
      // CombatTrigger→BattleEnd, mesma ordem de sempre).
      if (decision.trigger === "Destroyed" || decision.trigger === "Deploy" || decision.trigger === "CombatTrigger") {
        return finishDamageStep(next, actingPlayer);
      }
      return next;
    }

    case "resolveMulligan": {
      const decision = state.pendingDecision[actingPlayer];
      if (!decision || decision.kind !== "mulligan") {
        throw new Error("Não há Mulligan pendente pra esse jogador");
      }
      let next = applyEvent(state, { type: "CLEAR_PENDING_DECISION", player: actingPlayer });
      if (!action.keep) {
        // shuffle + redraw ficam no reducer (não há evento SHUFFLE), sobre o
        // clone que `applyEvent` acabou de devolver — determinístico via seed.
        redrawMulliganHand(next.players[actingPlayer], createRng(next.seed ^ mulliganNonce(actingPlayer)));
      }
      // Fluxo sequencial (ruling: "starting with Player One"): `activePlayer` é
      // sempre o 1º jogador até a 1ª troca de turno.
      if (actingPlayer === next.activePlayer) {
        // 1º jogador decidiu -> passa a vez pro 2º.
        return applyEvent(next, {
          type: "SET_PENDING_DECISION",
          player: otherPlayer(actingPlayer),
          decision: { kind: "mulligan" },
        });
      }
      // 2º jogador decidiu -> fecha o setup (6 shields cada + EX Base + EX
      // Resource do 2º) e entra na Main Phase.
      next = finishGameSetup(next);
      return advanceToMainPhase(next);
    }

    case "resolveZoneOverflow": {
      const decision = state.pendingDecision[actingPlayer];
      if (!decision || decision.kind !== "zoneOverflow") {
        throw new Error("Não há excesso de Units pendente pra resolver");
      }
      // Server-authoritative (mesmo padrão de `resolveAbility`, V0 docs/25):
      // nunca confia cegamente no `instanceId` que o cliente manda.
      if (!decision.legalTargets.includes(action.instanceId)) {
        throw new Error("Essa Unit não está entre as elegíveis pra ir pro trash");
      }
      let next = applyEvent(state, { type: "CLEAR_PENDING_DECISION", player: actingPlayer });
      // MOVE_CARD, nunca DESTROY_CARD — rules management, não é "destruída"
      // (mesma regra já aplicada à Base excedente em `deployCard`).
      next = applyEvent(next, { type: "MOVE_CARD", instanceId: action.instanceId, toZone: "trash" });
      return next;
    }
  }
}

/**
 * V2 (docs/27) — Comprehensive Rules: no máx. 6 Units na Battle Area por
 * jogador. Roda depois de QUALQUER `PlayerAction` (nunca bloqueia a ação que
 * causou o excesso — a carta/token sempre entra em campo primeiro); se algum
 * jogador está acima do limite e ainda não tem decisão pendente, pausa e pede
 * a escolha. Único ponto de checagem — nem `deployCard` nem o primitive
 * `spawnToken` precisam saber desta regra.
 */
function enforceZoneLimits(state: GameState): GameState {
  let next = state;
  for (const player of ["A", "B"] as PlayerId[]) {
    // Só UMA decisão pendente por vez, no jogo inteiro (invariante de checkStateInvariants):
    // se qualquer um dos dois lados já tem decisão pendente, resolve essa primeiro — o próximo
    // enforceZoneLimits (depois da ação que resolver a pendente) pega o excesso.
    if (next.pendingDecision.A || next.pendingDecision.B) continue;
    const units = next.players[player].battleArea.filter((c) => c.def.cardType === "UNIT");
    if (units.length <= 6) continue;
    next = applyEvent(next, {
      type: "SET_PENDING_DECISION",
      player,
      decision: { kind: "zoneOverflow", zone: "battleArea", legalTargets: units.map((u) => u.instanceId) },
    });
  }
  return next;
}

/**
 * `player` tem alguma jogada REAL disponível no Action Step atual (combate ou
 * fim de turno)? Usado pelo auto-pass (docs/19, Sessão 2, tarefa 4 — CR 7-6 /
 * 8-4): no servidor (`settleAutoPasses`, opt-in) e no cliente (auto-pass
 * incondicional quando não há jogada nenhuma). "Jogada real" = Command
 * 【Action】 jogável agora ou 【Activate·Action】 de carta em campo pagável.
 *
 * Direção do erro: esta função NUNCA pode dizer "não há jogada" quando há —
 * isso faria o auto-pass tirar uma jogada legal do jogador. Por isso nível e
 * custo usam `canPayLevel`/`effectiveCost` (os mesmos de `playCommand`), que
 * já aplicam reduções dinâmicas (`dynamicCost`/`dynamicLevel`, ex. GD01-016,
 * ST08-001). Toda redução nova de custo/nível TEM que entrar por esses dois
 * helpers, senão o auto-pass diverge do motor. O que não é checado aqui
 * (alvos legais, custos não-recurso como descarte/destruição) erra pro lado
 * seguro: conta como "tem jogada".
 *
 * Aceita `ViewGameState` (cliente): cartas ocultas são puladas — no cliente
 * só a mão do próprio viewer é conhecida, então chamar isto pro OPONENTE a
 * partir de uma view dá resposta incompleta (nunca vê a mão dele). As
 * condições de `dynamicCost`/`dynamicLevel` (`isBoardConditionMet`) só leem
 * zonas públicas (battleArea/baseSection/trash/combat), então o cast pra
 * `GameState` abaixo é seguro.
 */
export function playerHasActionStepPlay(
  state: GameState | ViewGameState,
  player: PlayerId,
  specs: EffectSpec[],
): boolean {
  const rulesState = state as GameState;
  const p = state.players[player];
  if (!p) return false;
  const activeResources = p.resourceArea.filter((r) => !isHiddenCard(r) && !r.rested).length;

  for (const card of p.hand) {
    if (isHiddenCard(card)) continue;
    if (card.def.cardType !== "COMMAND") continue;
    if (!card.def.triggerKeywords?.includes("Action")) continue;
    if (!canPayLevel(rulesState, player, card.def)) continue;
    if (activeResources < effectiveCost(card.def, rulesState, player)) continue;
    return true;
  }

  for (const zone of ["battleArea", "baseSection"] as const) {
    for (const card of p[zone]) {
      if (isHiddenCard(card)) continue;
      if (card.def.oncePerTurn && card.usedKeywordsThisTurn.includes("Activate·Action")) continue;
      const payable = findTriggerSpecs(specs, card.def.code, "Activate·Action").some(
        (spec) => !(costRestsSelf(spec) && card.rested) && activeResources >= specResourceCost(spec),
      );
      if (payable) return true;
    }
  }

  return false;
}

/**
 * Grava a decisão de 【Burst】 do defensor pra 1ª shield da fila; o resto fica em
 * `queuedInstanceIds`. `pendingDestroyed` carrega os 【Destroyed】 do mesmo Damage
 * Step, disparados quando a fila de 【Burst】 esvazia (docs/44).
 */
function setPendingBurst(
  state: GameState,
  player: PlayerId,
  shieldIds: string[],
  pendingDestroyed: DestroyedInBattle[] = [],
): GameState {
  const [first, ...rest] = shieldIds;
  const card = findCard(state, first);
  return applyEvent(state, {
    type: "SET_PENDING_DECISION",
    player,
    decision: {
      kind: "burst",
      cardInstanceId: first,
      cardDef: card.def,
      choices: [],
      queuedInstanceIds: rest,
      pendingDestroyed,
    },
  });
}

/**
 * docs/47 Fase 6 — converte `combat.pendingTriggerChoices` (Sinanju
 * `damageChosenEnemyUnit`, Akihiro Altland `retrieveFromTrash`) numa pausa
 * `PendingDecision.abilityResolution`. Reusa os MESMOS campos de fila já
 * existentes (`needsTarget`/`legalTargets` — mesma UI de "escolha 1 alvo" já
 * usada por 【When Paired】/【Attack】; `trashSearch` — mesma UI de busca na
 * lixeira de GD01-067) pra não precisar de nenhuma mudança em
 * `AbilityResolutionModal.tsx`. `specId` é sintético, nunca existe em `specs`
 * — `resolveAbility` reconhece essas entradas pelo campo `combatTrigger` e
 * compila o `action` bruto direto, sem `dispatchTrigger`.
 */
function pauseForCombatTriggerChoices(state: GameState, player: PlayerId, choices: PendingCombatTriggerChoice[]): GameState {
  const queue = choices.map((choice, i) => {
    const specId = `${choice.sourceInstanceId}-combatTrigger-${i}`;
    const base = {
      sourceInstanceId: choice.sourceInstanceId,
      specId,
      label: choice.label,
      optional: false,
      combatTrigger: choice,
    };
    if (choice.action.kind === "retrieveFromTrash") {
      return { ...base, needsTarget: false, targetScope: "enemyUnit" as const, legalTargets: [], trashSearch: { legalTrashIds: choice.legalCandidates, label: choice.label } };
    }
    return { ...base, needsTarget: true, targetScope: "enemyUnit" as const, legalTargets: choice.legalCandidates };
  });
  const next = applyEvent(state, {
    type: "SET_PENDING_DECISION",
    player,
    decision: { kind: "abilityResolution", trigger: "CombatTrigger", queue },
  });
  if (next.combat) next.combat.pendingTriggerChoices = undefined;
  return next;
}

/**
 * docs/47 Fase 6 — ponto único de saída do Damage Step: Burst → Destroyed →
 * escolha de gatilho de combate (Sinanju/Akihiro Altland) → Battle End.
 * Chamado depois que o chamador já processou Burst/Destroyed pra este passo.
 */
function finishDamageStep(next: GameState, actingPlayer: PlayerId): GameState {
  if (next.gameOver) return next;
  if (next.pendingDecision[actingPlayer] || next.pendingDecision[otherPlayer(actingPlayer)]) return next;
  if (next.combat?.pendingTriggerChoices?.length) {
    return pauseForCombatTriggerChoices(next, next.combat.attackingPlayer, next.combat.pendingTriggerChoices);
  }
  if (next.combat?.step !== "damage") return next;
  return resolveBattleEndStep(next);
}
