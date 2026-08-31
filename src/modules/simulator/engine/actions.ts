import type { AttackTarget, GameState, PlayerId } from "./types";
import type { EffectSpec, PredicateResolver } from "./effectSpec";
import { findCard } from "./events";
import { deployCard, playCommand } from "./deploy";
import { declareAttack, proceedToBlockStep, activateBlocker, skipBlock, passAction, resolveDamageStep, resolveBattleEndStep } from "./combat";
import { beginEndPhaseActionStep, finishEndPhaseAndAdvance, passEndPhaseAction } from "./phases";
import { dispatchBurstForNewlyTrashedShields } from "./dispatcher";

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
 * Escopo desta wave (documentado, não fingido — mesma convenção do resto do
 * docs/18): 【Burst】 de shield sempre é recusado automaticamently
 * (`chooseBurst` default `() => false` de `dispatcher.ts`) — ativar Burst por
 * escolha real do jogador exige um ponto de decisão na UI que ainda não
 * existe. Do mesmo jeito, gatilhos que dependem de alvo escolhido fora de
 * Deploy/When Paired (ex. `<Attack>` da Suletta Mercury, `<Activate·Main>` do
 * Tallgeese, Command 【Action】além do fluxo padrão) não têm `PlayerAction`
 * própria ainda — o núcleo jogável (deploy, ataque, bloqueio, passar turno)
 * já é suficiente pra validar a arquitetura de sessão dupla/redação de
 * informação, que é o objetivo desta wave.
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
  | { kind: "passEndPhaseAction" };

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
      // Attack Step -> Block Step não é decisão de ninguém, é avanço automático.
      return proceedToBlockStep(declareAttack(state, action.attackerId, action.target));
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
      next = dispatchBurstForNewlyTrashedShields(beforeDamage, next, defendingPlayer, specs, () => false, predicateResolver);
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
  }
}
