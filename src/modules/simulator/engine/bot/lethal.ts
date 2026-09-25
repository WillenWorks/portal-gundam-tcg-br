import type { CardInstance, GameState } from "../types";
import { effectiveAp, effectiveHp, hasKeyword, otherPlayer } from "../types";
import type { ViewCardInstance, ViewGameState } from "../viewState";
import type { LegalAction } from "../legalActions";

/**
 * Nota de um ataque ao jogador quando há linha letal: acima de qualquer outra
 * jogada das policies heurísticas (a maior nota de ataque a Unit é ~35 + valor).
 */
export const LETHAL_ATTACK_SCORE = 1000;

function isReal(card: ViewCardInstance): card is CardInstance {
  return !("hidden" in card);
}

/**
 * Há linha letal neste turno? Conta só o que o bot vê e só ataques ao jogador
 * que o motor permite agora (`legal`). Conservador: cada <Blocker> ativo do
 * oponente anula o atacante mais forte; a Base (dano persiste no turno) consome
 * atacantes do mais forte ao mais fraco até cair; cada escudo consome um
 * atacante; sobrando um, ele bate no jogador. Ignora Burst, efeitos de Action
 * Step do oponente e <Breach> — o risco é o bot atacar o jogador sem letal real,
 * o que numa situação dessas raramente é pior que a alternativa.
 */
export function hasLethalLine(view: ViewGameState, legal: LegalAction[]): boolean {
  if (view.combat) return false;
  const state = view as unknown as GameState;
  const me = view.viewer;
  const opp = view.players[otherPlayer(me)];

  const attackerIds = new Set<string>();
  for (const a of legal) {
    if (a.kind === "declareAttack" && a.target === "player") attackerIds.add(a.attackerId);
  }
  if (attackerIds.size === 0) return false;

  const aps = view.players[me].battleArea
    .filter(isReal)
    .filter((u) => attackerIds.has(u.instanceId))
    .map((u) => effectiveAp(u, state))
    .filter((ap) => ap > 0)
    .sort((x, y) => y - x);

  const oppUnits = opp.battleArea.filter(isReal);
  const activeBlockers = oppUnits.filter((u) => !u.rested && hasKeyword(u, "Blocker", state)).length;
  const remaining = aps.slice(activeBlockers);

  const oppBase = opp.baseSection.filter(isReal)[0];
  let i = 0;
  if (oppBase) {
    let baseHp = Math.max(0, effectiveHp(oppBase, state) - oppBase.damage);
    while (baseHp > 0 && i < remaining.length) baseHp -= remaining[i++];
    if (baseHp > 0) return false;
  }
  return remaining.length - i >= opp.counts.shields + 1;
}
