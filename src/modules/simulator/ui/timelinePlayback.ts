/* Spec simulador-animacao-pelo-log, fase 3: o que a tela toca a partir dos eventos de uma visão. Puro/testável — a
 * página só executa o plano. Enquanto a visão não trouxer eventos contínuos (`timelineFor` → `null`), a página usa as
 * deduções antigas por comparação de visões (`viewAnimationQueue.ts`). */
import type { AttackTarget, CardDef, CardInstance, PlayerId } from "../engine/types";
import type { ViewGameState } from "../engine/viewState";
import { isHiddenCard } from "../engine/viewState";
import { timelineFromEvents, type AnimationStep } from "./eventTimeline";
import type { SimulatorMatchView } from "@/lib/api";

/**
 * Os passos desta visão, se ela continua exatamente a última aplicada (`eventsFromSeq === lastSeq`). `null` = sem
 * eventos (GET/POST, reconexão, lote grande) ou buraco na sequência — não dá para animar pelo log.
 */
export function timelineFor(incoming: Pick<SimulatorMatchView, "eventsSince" | "eventsFromSeq">, lastSeq: number | null): AnimationStep[] | null {
  if (!incoming.eventsSince || incoming.eventsFromSeq === undefined) return null;
  if (lastSeq === null || incoming.eventsFromSeq !== lastSeq) return null;
  return timelineFromEvents(incoming.eventsSince);
}

/** a visão já foi aplicada (ex.: a resposta do POST chegou antes da transmissão do mesmo estado) */
export function isRepeatedView(incoming: Pick<SimulatorMatchView, "eventSeq">, lastSeq: number | null): boolean {
  return incoming.eventSeq !== undefined && lastSeq !== null && incoming.eventSeq <= lastSeq;
}

export interface PendingAttack {
  attackerId: string;
  target: AttackTarget;
  defendingPlayer: PlayerId;
}

export type PlannedAnimation =
  | { kind: "opponentCommand"; instanceId: string }
  | { kind: "strike"; attackerId: string; target: AttackTarget; defendingPlayer: PlayerId };

/**
 * O que tocar, na ordem dos eventos: a Command jogada pelo oponente e o golpe de cada combate. O golpe sai quando o
 * combate TERMINA, contra o alvo final (bloqueio e "change the attack target" já aplicados) — mesmo momento do golpe
 * antigo. Combate que continua na próxima visão (esperando meu bloqueio, Action Step) volta em `pendingAttack`.
 */
export function planAnimations(
  steps: readonly AnimationStep[],
  viewerSeat: PlayerId,
  pendingAttack: PendingAttack | null,
): { plan: PlannedAnimation[]; pendingAttack: PendingAttack | null } {
  const plan: PlannedAnimation[] = [];
  let attack = pendingAttack;
  for (const step of steps) {
    switch (step.kind) {
      case "cardPlayed":
        if (step.as === "command" && step.player !== viewerSeat) plan.push({ kind: "opponentCommand", instanceId: step.instanceId });
        break;
      case "attack":
        attack = { attackerId: step.attackerId, target: step.target, defendingPlayer: step.defendingPlayer };
        break;
      case "block":
        if (attack) attack = { ...attack, target: step.target };
        break;
      case "retarget":
        if (attack) attack = { ...attack, target: { unitId: step.unitId } };
        break;
      case "combatEnd":
        if (attack) plan.push({ kind: "strike", ...attack });
        attack = null;
        break;
      default:
        break;
    }
  }
  return { plan, pendingAttack: attack };
}

/** a carta, se está à vista em alguma zona da visão (a Command jogada fica no trash, público) */
export function cardDefInView(view: ViewGameState, instanceId: string): CardDef | null {
  for (const player of Object.values(view.players)) {
    for (const zone of [player.trash, player.exile, player.battleArea, player.baseSection, player.hand, player.resourceArea]) {
      const card = zone.find((c) => c.instanceId === instanceId);
      if (card && !isHiddenCard(card)) return (card as CardInstance).def;
    }
  }
  return null;
}
