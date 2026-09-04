import type { AttackTarget, GameState, PlayerId } from "./types";
import type { EffectSpec, PredicateResolver } from "./effectSpec";
import { applyEvent, findCard } from "./events";
import { deployCard, playCommand } from "./deploy";
import { declareAttack, proceedToBlockStep, activateBlocker, skipBlock, passAction, resolveDamageStep, resolveBattleEndStep } from "./combat";
import { advanceToMainPhase, beginEndPhaseActionStep, finishEndPhaseAndAdvance, passEndPhaseAction } from "./phases";
import { burstEligibleShieldIds, dispatchTrigger, findTriggerSpecs } from "./dispatcher";
import { deferOrDispatchAbilities } from "./abilityDispatch";
import { activateSupport } from "./keywords";
import { finishGameSetup, mulliganNonce, redrawMulliganHand } from "./setup";
import { createRng } from "./rng";
import { hasKeyword, otherPlayer } from "./types";

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
      resolutions: Array<{ specId: string; activate: boolean; targetIds: string[] }>;
    }
  /**
   * Resolve a `PendingDecision.mulligan` de início de partida (Comprehensive
   * Rules 6-2 / ruling oficial). `keep: false` = troca a mão (mão inteira pro
   * fundo do deck, re-embaralha, compra 5). Sequencial: ao resolver o 1º
   * jogador o motor seta o mulligan do 2º; ao resolver o 2º, coloca os 6
   * shields de cada lado + EX Base + EX Resource e avança pra Main Phase.
   */
  | { kind: "resolveMulligan"; keep: boolean };

/**
 * Aplica uma `PlayerAction` declarada por `actingPlayer`. Lança erro (motivo
 * legível, igual ao resto do motor) se a ação for ilegal — quem chama decide
 * o que fazer com isso (a rota HTTP devolve 400 com a mensagem).
 */
export function applyPlayerAction(
  state: GameState,
  actingPlayer: PlayerId,
  action: PlayerAction,
  specs: EffectSpec[],
  predicateResolver?: PredicateResolver,
): GameState {
  // Decisão interativa pendente trava tudo (docs/19, Sessão 2): enquanto o
  // defensor não resolve o Burst (ou quem controla não ordena os gatilhos),
  // nenhuma outra ação — de nenhum dos dois — avança o estado.
  if (state.pendingDecision[otherPlayer(actingPlayer)]) {
    throw new Error("Aguardando o oponente resolver uma decisão pendente (Burst / ordem de gatilhos)");
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
  }

  switch (action.kind) {
    case "deployCard":
      return deployCard(state, actingPlayer, action.cardInstanceId, {
        resourceInstanceIds: action.resourceInstanceIds,
        pairWithUnitId: action.pairWithUnitId,
        specs,
        targets: action.targets,
        predicateResolver,
      });

    case "playCommand":
      return playCommand(state, actingPlayer, action.cardInstanceId, action.trigger, specs, {
        resourceInstanceIds: action.resourceInstanceIds,
        targets: action.targets,
        predicateResolver,
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
        { predicateResolver },
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

      const defendingPlayer = beforeDamage.combat!.defendingPlayer;
      const burstIds = burstEligibleShieldIds(beforeDamage, next, defendingPlayer, specs);
      if (burstIds.length > 0) {
        // PAUSA autoritativa (docs/19, Sessão 2): combate fica parado no Damage
        // Step, o defensor decide via `resolveBurstDecision`. O Battle End só
        // roda quando a fila de Burst esvazia.
        return setPendingBurst(next, defendingPlayer, burstIds);
      }
      return resolveBattleEndStep(next);
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

      // 【Activate·Main】 (fora de combate) ou 【Activate·Action】 (no Action Step de combate).
      const inActionStep = state.combat?.step === "action";
      const trigger = inActionStep ? "Activate·Action" : "Activate·Main";
      if (!inActionStep) {
        if (state.phase !== "main") throw new Error("【Activate·Main】 só pode ser ativado na Main Phase");
        if (state.combat) throw new Error("【Activate·Main】 não pode ser ativado durante um combate");
        if (state.activePlayer !== actingPlayer) throw new Error("Só o jogador ativo pode ativar 【Activate·Main】");
      } else if (state.combat!.actionPriority !== actingPlayer) {
        throw new Error("Não é a prioridade desse jogador no Action Step");
      }

      const abilitySpecs = findTriggerSpecs(specs, source.def.code, trigger);
      if (abilitySpecs.length > 0) {
        return dispatchTrigger(state, action.sourceInstanceId, trigger, specs, {
          targets: action.targets,
          costResourceIds: action.resourceInstanceIds,
          predicateResolver,
        });
      }

      // Sem EffectSpec de 【Activate·Main】 — cai em `<Support N>` (keyword de motor).
      if (hasKeyword(source, "Support")) {
        const supportTargetId = action.targets?.target?.[0];
        if (!supportTargetId) throw new Error("<Support> precisa de uma Unit amiga alvo (targets.target[0])");
        return activateSupport(state, action.sourceInstanceId, supportTargetId);
      }

      throw new Error(`${source.def.code} não tem 【Activate·Main】 nem <Support> pra ativar`);
    }

    case "resolveBurstDecision": {
      const decision = state.pendingDecision[actingPlayer];
      if (!decision || decision.kind !== "burst") {
        throw new Error("Não há decisão de 【Burst】 pendente pra esse jogador");
      }
      let next = applyEvent(state, { type: "CLEAR_PENDING_DECISION", player: actingPlayer });
      if (action.activate) {
        next = dispatchTrigger(next, decision.cardInstanceId, "Burst", specs, {
          targets: action.targets ?? {},
          predicateResolver,
        });
      }
      if (decision.queuedInstanceIds.length > 0) {
        return setPendingBurst(next, actingPlayer, decision.queuedInstanceIds);
      }
      // Fila esvaziou: fecha o combate se ele ainda está parado no Damage Step.
      if (!next.gameOver && next.combat?.step === "damage") {
        next = resolveBattleEndStep(next);
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
        next = dispatchTrigger(next, trig.instanceId, trig.trigger, specs.filter((s) => s.id === specId), {
          predicateResolver,
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
      for (const r of action.resolutions) {
        const q = decision.queue.find((x) => x.specId === r.specId)!;
        // pulado, ou "Choose 1 ..." sem alvo legal disponível = nada acontece (regra oficial).
        if (!r.activate || (q.needsTarget && r.targetIds.length === 0)) continue;
        next = dispatchTrigger(next, q.sourceInstanceId, decision.trigger, specs.filter((s) => s.id === r.specId), {
          targets: { target: r.targetIds, shield: r.targetIds },
          predicateResolver,
        });
      }
      // veio de 【Attack】: o combate estava parado no Attack Step -> segue pro Block Step.
      if (decision.trigger === "Attack" && !next.gameOver && next.combat?.step === "attack") {
        return proceedToBlockStep(next);
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
  }
}

/**
 * `player` tem alguma jogada REAL disponível no Action Step atual (combate ou
 * fim de turno)? Usado pelo auto-pass inteligente (docs/19, Sessão 2, tarefa
 * 4 — CR 7-6 / 8-4): se o jogador com prioridade optou por `autoPassActionStep`
 * E não tem nada pra fazer aqui, o servidor passa na hora, sem esperar o
 * timer de 90s. "Jogada real" = Command 【Action】 jogável agora (nível +
 * custo pagáveis) ou 【Activate·Action】 de carta em campo ainda não usado.
 */
export function playerHasActionStepPlay(state: GameState, player: PlayerId, specs: EffectSpec[]): boolean {
  const p = state.players[player];
  const activeResources = p.resourceArea.filter((r) => !r.rested).length;
  const totalResources = p.resourceArea.length;

  for (const card of p.hand) {
    if (card.def.cardType !== "COMMAND") continue;
    if (!card.def.triggerKeywords?.includes("Action")) continue;
    if (totalResources < (card.def.level ?? 0)) continue;
    if (activeResources < (card.def.cost ?? 0)) continue;
    return true;
  }

  for (const zone of ["battleArea", "baseSection"] as const) {
    for (const card of p[zone]) {
      if (findTriggerSpecs(specs, card.def.code, "Activate·Action").length === 0) continue;
      if (card.def.oncePerTurn && card.usedKeywordsThisTurn.includes("Activate·Action")) continue;
      return true;
    }
  }

  return false;
}

/** Grava a decisão de 【Burst】 do defensor pra 1ª shield da fila; o resto fica em `queuedInstanceIds`. */
function setPendingBurst(state: GameState, player: PlayerId, shieldIds: string[]): GameState {
  const [first, ...rest] = shieldIds;
  const card = findCard(state, first);
  return applyEvent(state, {
    type: "SET_PENDING_DECISION",
    player,
    decision: { kind: "burst", cardInstanceId: first, cardDef: card.def, choices: [], queuedInstanceIds: rest },
  });
}
