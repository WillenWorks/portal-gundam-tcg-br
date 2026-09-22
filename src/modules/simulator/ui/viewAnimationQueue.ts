/* "Nova leva de correções" (item 3, plano v2) — predicados puros usados pela
 * fila de reprodução serializada de `SimulatorMatchPage.tsx` (`applyIncomingView`
 * / `drainViewQueue`). Extraídos daqui pra serem testáveis sem montar a página
 * inteira (que precisaria de socket, board refs, etc. mockados).
 *
 * Causa raiz que essa fila resolve: em modo treino, humano e bot têm
 * `autoPassActionStep: true` (`trainingMatch.ts`) e `settleAutoPasses`
 * (`matchStore.ts`) resolve o Action Step dos dois lados de forma síncrona no
 * servidor — o cliente nunca observa `combat.step === "action"` isoladamente,
 * e várias `match:view_update` podem chegar quase juntas quando o bot faz
 * várias ações em sequência. Sem fila, cada mensagem processava por conta
 * própria, e só a que por acaso encontrava uma animação pendente esperava —
 * as outras aplicavam o estado final na hora, sem nenhuma animação visível. */
import type { CombatState, PendingDecision } from "../engine/types";

/**
 * Decide se a transição de `prevCombat` pra `incomingCombat` deve disparar o
 * lunge de ataque (`executeAttackStrike`). Dispara sempre que o combate do
 * MESMO atacante deixou de existir (ausente, trocou de `attackerId`, ou
 * terminou em `"battleEnd"`) — independente de qual era o `step` anterior
 * exato (`"attack"`, `"block"` ou `"action"` servem igual, já que
 * `attackerId`/`currentTarget`/`defendingPlayer` existem em `CombatState`
 * desde o passo `"attack"`).
 */
export function shouldAnimateAttackStrike(prevCombat: CombatState | null, incomingCombat: CombatState | null): boolean {
  if (!prevCombat) return false;
  if (!incomingCombat) return true;
  if (incomingCombat.attackerId !== prevCombat.attackerId) return true;
  if (incomingCombat.step === "battleEnd") return true;
  return false;
}

/**
 * Decide se a fila deve esperar a revelação cinemática do 【Burst】
 * (`BurstRevealStage`) terminar antes de liberar a próxima view — só quando a
 * decisão pendente do PRÓPRIO jogador é um Burst ainda não revelado.
 */
export function shouldWaitForBurstReveal(
  pendingDecision: PendingDecision | null | undefined,
  revealedId: string | null,
): boolean {
  return Boolean(pendingDecision && pendingDecision.kind === "burst" && pendingDecision.cardInstanceId !== revealedId);
}
