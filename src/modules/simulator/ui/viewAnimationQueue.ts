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
import type {
  CardDef,
  CardInstance,
  CombatState,
  PendingDecision,
  PlayerId,
} from "../engine/types";
import type { ViewCardInstance, ViewGameState } from "../engine/viewState";

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

function isCardInstance(card: ViewCardInstance): card is CardInstance {
  return !("hidden" in card && (card as { hidden?: boolean }).hidden === true);
}

/**
 * Decide se a transição de `prevView` pra `incomingView` representa um Comando
 * jogado pelo oponente (que saiu da mão dele e foi parar no Trash dele com
 * cardType "COMMAND"). Retorna a `CardDef` do comando se detectado, ou `null`.
 */
export function detectOpponentCommandCast(
  prevView: ViewGameState | null,
  incomingView: ViewGameState,
  viewerSeat: PlayerId,
): CardDef | null {
  if (!prevView) return null;
  const opponentSeat: PlayerId = viewerSeat === "A" ? "B" : "A";
  const prevOpponent = prevView.players[opponentSeat];
  const curOpponent = incomingView.players[opponentSeat];
  if (!prevOpponent || !curOpponent) return null;

  const prevHandIds = new Set(prevOpponent.hand.map((c) => c.instanceId));
  const prevTrashIds = new Set(prevOpponent.trash.map((c) => c.instanceId));

  for (const c of curOpponent.trash) {
    if (prevTrashIds.has(c.instanceId)) continue;
    if (!prevHandIds.has(c.instanceId)) continue;
    if (curOpponent.hand.some((h) => h.instanceId === c.instanceId)) continue;
    if (isCardInstance(c) && c.def?.cardType === "COMMAND") {
      return c.def;
    }
  }

  return null;
}

export interface Point2D {
  x: number;
  y: number;
}

export function getSafePoint(
  rect: DOMRect | null | undefined,
  fallbackCenter: Point2D,
): Point2D {
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return fallbackCenter;
  }
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  if (center.x === 0 && center.y === 0) {
    return fallbackCenter;
  }
  return center;
}

export function resolveCommandAnimationPoints(
  board: { rectOf: (key: string) => DOMRect | null },
  opponentSeat: PlayerId,
  fallbackCenter: Point2D,
): { origin: Point2D; dest: Point2D } {
  const oppHandRect = board.rectOf("hand:opponent") ?? board.rectOf(`hand:${opponentSeat}`);
  const origin = getSafePoint(oppHandRect, fallbackCenter);

  const oppTrashRect = board.rectOf(`trashStation:${opponentSeat}`);
  const dest = getSafePoint(oppTrashRect, fallbackCenter);

  return { origin, dest };
}

export async function handleOpponentCommandCast({
  prevView,
  incomingView,
  viewerSeat,
  board,
  fallbackCenter,
  animateCommand,
}: {
  prevView: ViewGameState | null;
  incomingView: ViewGameState;
  viewerSeat: PlayerId;
  board: { rectOf: (key: string) => DOMRect | null };
  fallbackCenter: Point2D;
  animateCommand: (params: { cardDef: CardDef; origin: Point2D; dest: Point2D }) => Promise<void>;
}): Promise<boolean> {
  const commandDef = detectOpponentCommandCast(prevView, incomingView, viewerSeat);
  if (!commandDef) return false;

  const opponentSeat: PlayerId = viewerSeat === "A" ? "B" : "A";
  const { origin, dest } = resolveCommandAnimationPoints(board, opponentSeat, fallbackCenter);

  await animateCommand({ cardDef: commandDef, origin, dest });
  return true;
}

