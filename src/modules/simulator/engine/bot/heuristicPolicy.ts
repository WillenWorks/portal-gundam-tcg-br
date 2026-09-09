import type { AttackTarget, CardDef, CardInstance, GameState, PlayerId } from "../types";
import { effectiveAp, effectiveHp, hasKeyword, otherPlayer, satisfiesLinkCondition } from "../types";
import type { ViewCardInstance, ViewGameState, ViewPlayerState } from "../viewState";
import type { LegalAction } from "../legalActions";
import type { Rng } from "../rng";
import type { SelfPlayPolicy } from "../selfPlay";

/**
 * Bot heurístico (docs/44, Fase 2 — §4.1). `chooseAction` é PURA e
 * determinística dado o `rng` recebido: sem LLM, sem I/O, sem `Date.now()`,
 * sem `Math.random()` (o `rng` seedado é a única fonte de aleatoriedade, usada
 * só pra desempate entre ações de valor idêntico).
 *
 * O bot decide a partir da VIEW dele (`viewStateFor`), nunca do `GameState`
 * completo — as zonas que ele lê pra pontuar (battle area, base, própria mão)
 * são todas públicas na view, então re-tipar a view como `GameState` para os
 * leitores puros de `types.ts` (`effectiveAp`/`effectiveHp`, que só tocam
 * `players[owner].battleArea` e `activePlayer`) é honesto.
 *
 * Heurística iterável — a pontuação abaixo é a v1 do §4.1. Dois níveis de
 * dificuldade:
 * - `facil`: joga "burro" — deploy da 1ª Unit legal, ataque só no jogador, sem
 *   efeitos, sem bloqueio, recusa Burst.
 * - `normal`: heurística cheia — deploy da Unit maior, forma Link, troca só
 *   favorável, chip nos escudos, bloqueio pra preservar tabuleiro/Base, usa
 *   remoção/efeito na maior ameaça.
 */

export type HeuristicLevel = "facil" | "normal";

export interface HeuristicPolicyOptions {
  level?: HeuristicLevel;
}

const LATE_GAME_TURN = 8;

function isReal(card: ViewCardInstance): card is CardInstance {
  return !("hidden" in card);
}

function byId<T extends { instanceId: string }>(list: T[], id: string): T | undefined {
  return list.find((c) => c.instanceId === id);
}

function asEngineState(view: ViewGameState): GameState {
  return view as unknown as GameState;
}

function realUnits(player: ViewPlayerState): CardInstance[] {
  return player.battleArea.filter(isReal).filter((c) => c.def.cardType === "UNIT");
}

function unitValue(card: CardInstance, state: GameState): number {
  return effectiveAp(card, state) + effectiveHp(card, state);
}

function remHp(card: CardInstance, state: GameState): number {
  return Math.max(0, effectiveHp(card, state) - card.damage);
}

function pilotDefForLink(card: CardInstance): CardDef {
  if (card.def.pilotMode) {
    return { ...card.def, cardType: "PILOT", nameEn: card.def.pilotMode.pilotName };
  }
  return card.def;
}

interface Ctx {
  view: ViewGameState;
  state: GameState;
  me: PlayerId;
  opp: PlayerId;
  myUnits: CardInstance[];
  oppUnits: CardInstance[];
  myBase: CardInstance | null;
  myHand: CardInstance[];
  myShieldCount: number;
}

function buildCtx(view: ViewGameState): Ctx {
  const me = view.viewer;
  const opp = otherPlayer(me);
  const myPlayer = view.players[me];
  const oppPlayer = view.players[opp];
  return {
    view,
    state: asEngineState(view),
    me,
    opp,
    myUnits: realUnits(myPlayer),
    oppUnits: realUnits(oppPlayer),
    myBase: myPlayer.baseSection.filter(isReal)[0] ?? null,
    myHand: myPlayer.hand.filter(isReal),
    myShieldCount: myPlayer.counts.shields,
  };
}

function actionTargetId(action: LegalAction): string | null {
  if ("targets" in action && action.targets) {
    const target = action.targets.target;
    if (target && target.length > 0) return target[0];
  }
  return null;
}

/** Valor de mirar `id`: ameaça inimiga pontua cheio (remoção na maior ameaça); Unit amiga, metade (buff). */
function targetBonus(ctx: Ctx, id: string): number {
  const enemy = byId(ctx.oppUnits, id);
  if (enemy) return unitValue(enemy, ctx.state);
  const friend = byId(ctx.myUnits, id);
  if (friend) return unitValue(friend, ctx.state) * 0.5;
  return 0;
}

/**
 * "nunca ataca deixando a própria Base morrer no contra-ataque" (docs/44 §4.1).
 *
 * Só um <Blocker> ativo protege a Base do contra-ataque — atacar com uma Unit
 * SEM <Blocker> nunca reduz a defesa (ela ia descansar de qualquer jeito e
 * Units comuns não bloqueiam). Então a trava só faz sentido quando o atacante
 * É um <Blocker> que é exatamente a margem entre a Base viver e morrer no turno
 * seguinte. Fora disso o bot chip o jogador à vontade — agressão fecha a
 * partida (sem isso, dois bots normais empatam até o deck-out).
 */
function playerAttackWouldDoomBase(ctx: Ctx, attacker: CardInstance): boolean {
  if (ctx.view.turnNumber >= LATE_GAME_TURN) return false;
  if (!ctx.myBase) return false;
  if (ctx.myShieldCount < 3) return false; // já perdendo a corrida — atacar é a saída
  if (!hasKeyword(attacker, "Blocker")) return false;

  const baseHpRem = remHp(ctx.myBase, ctx.state);
  const oppApTotal = ctx.oppUnits.reduce((sum, u) => sum + effectiveAp(u, ctx.state), 0);
  const otherBlockerHp = ctx.myUnits
    .filter((u) => u.instanceId !== attacker.instanceId && !u.rested && hasKeyword(u, "Blocker"))
    .reduce((sum, u) => sum + remHp(u, ctx.state), 0);

  const survivesIfHeld = oppApTotal < baseHpRem + otherBlockerHp + remHp(attacker, ctx.state);
  const diesIfAttacks = oppApTotal >= baseHpRem + otherBlockerHp;
  return survivesIfHeld && diesIfAttacks;
}

function scoreBlock(ctx: Ctx, blockerId: string): number {
  const combat = ctx.view.combat;
  if (!combat) return -5;
  const attacker = byId(ctx.oppUnits, combat.attackerId);
  const blocker = byId(ctx.myUnits, blockerId);
  if (!attacker || !blocker) return -5;

  const atkAp = effectiveAp(attacker, ctx.state);
  const blockerVal = unitValue(blocker, ctx.state);
  const blockerSurvives = remHp(blocker, ctx.state) > atkAp;
  const blockerKillsAtk = effectiveAp(blocker, ctx.state) >= remHp(attacker, ctx.state);

  // bloquear redireciona o ataque inteiro pro bloqueador — a Unit/Base originalmente
  // mirada não recebe nada. Vale mesmo com chump-block (bloqueador morre) se o que
  // se salva vale mais que ele; sobrevivência/troca do bloqueador é só um bônus.
  const survivalBonus = blockerSurvives ? 5 : blockerKillsAtk ? 3 : 0;

  const target = combat.currentTarget;
  if (target !== "player") {
    const saved = byId(ctx.myUnits, target.unitId);
    if (!saved) return -5;
    const savedDies = remHp(saved, ctx.state) <= atkAp;
    const savedVal = unitValue(saved, ctx.state);
    if (savedDies && savedVal > blockerVal) {
      return 12 + (savedVal - blockerVal) + survivalBonus;
    }
    return -5;
  }

  const baseInDanger = !!ctx.myBase && remHp(ctx.myBase, ctx.state) <= atkAp;
  const shieldsLow = !ctx.myBase && ctx.myShieldCount <= 1;
  if (baseInDanger || shieldsLow) {
    return 8 + survivalBonus;
  }
  return -5;
}

function scoreAttack(ctx: Ctx, attackerId: string, target: AttackTarget): number {
  const attacker = byId(ctx.myUnits, attackerId);
  if (!attacker) return 0;
  const atkAp = effectiveAp(attacker, ctx.state);
  const atkHpRem = remHp(attacker, ctx.state);

  if (target === "player") {
    if (playerAttackWouldDoomBase(ctx, attacker)) return -1;
    return 14 + 2 * atkAp;
  }

  const enemy = byId(ctx.oppUnits, target.unitId);
  if (!enemy) return 0;
  const enemyAp = effectiveAp(enemy, ctx.state);
  const enemyHpRem = remHp(enemy, ctx.state);
  const enemyVal = unitValue(enemy, ctx.state);
  const kills = atkAp >= enemyHpRem;
  const survives = enemyAp < atkHpRem;

  if (kills && survives) return 35 + enemyVal;
  if (kills && !survives) return enemyVal >= unitValue(attacker, ctx.state) ? 20 : 7;
  if (!survives) return -1;
  return 3;
}

function scoreDeploy(ctx: Ctx, action: Extract<LegalAction, { kind: "deployCard" }>): number {
  const card = byId(ctx.myHand, action.cardInstanceId);
  if (!card) return 8;
  const def = card.def;

  if (action.pairWithUnitId) {
    const unit = byId(ctx.myUnits, action.pairWithUnitId);
    const formsLink = !!unit && satisfiesLinkCondition(pilotDefForLink(card), unit.def);
    const pilotStats = (def.pilotMode?.ap ?? def.ap ?? 0) + (def.pilotMode?.hp ?? def.hp ?? 0);
    return 22 + pilotStats + (formsLink ? 15 : 0);
  }
  if (def.cardType === "UNIT") {
    // penaliza floodar o tabuleiro — depois de ~4 Units, atacar rende mais que a 5ª/6ª
    return 25 + (def.ap ?? 0) + (def.hp ?? 0) - 4 * ctx.myUnits.length;
  }
  if (def.cardType === "BASE") {
    return ctx.myBase ? 4 : 18;
  }
  return 8;
}

function scoreNormal(action: LegalAction, _index: number, ctx: Ctx): number {
  switch (action.kind) {
    case "finishTurn":
    case "passAction":
    case "passEndPhaseAction":
    case "skipBlock":
      return 0;
    case "resolveTriggerOrder":
      return 1;
    case "resolveMulligan": {
      const keepGood = ctx.myHand.some((c) => c.def.cardType === "UNIT" && (c.def.level ?? 99) <= 2);
      if (action.keep) return keepGood ? 10 : 1;
      return keepGood ? 0 : 10;
    }
    case "resolveZoneOverflow": {
      const unit = byId(ctx.myUnits, action.instanceId);
      return 100 - (unit ? unitValue(unit, ctx.state) : 0);
    }
    case "resolveBurstDecision": {
      if (!action.activate) return 3;
      const id = actionTargetId(action);
      return 12 + (id ? targetBonus(ctx, id) : 0);
    }
    case "resolveAbility": {
      const activated = action.resolutions.filter((r) => r.activate);
      if (activated.length === 0) return 2;
      let score = 4 * activated.length;
      for (const r of activated) {
        if (r.targetIds.length > 0) {
          score += 10 * r.targetIds.length;
          for (const id of r.targetIds) score += targetBonus(ctx, id);
        }
      }
      return score;
    }
    case "activateBlocker":
      return scoreBlock(ctx, action.blockerId);
    case "declareAttack":
      return scoreAttack(ctx, action.attackerId, action.target);
    case "deployCard":
      return scoreDeploy(ctx, action);
    case "playCommand":
    case "activateAbility": {
      // v1 (docs/44 §4.1): só vale a pena quando é remoção/dano na maior ameaça —
      // um efeito mirado numa Unit inimiga. Efeitos sem alvo ou mirados em si
      // mesmo/aliado ficam abaixo do "não fazer nada" (0): muitos são repetíveis
      // (pumps, <Support>) e prendem o bot num laço de ação dentro do mesmo turno.
      const id = actionTargetId(action);
      const enemy = id ? byId(ctx.oppUnits, id) : undefined;
      if (!enemy) return -1;
      return 6 + unitValue(enemy, ctx.state);
    }
    default:
      return 0;
  }
}

function scoreFacil(action: LegalAction, index: number, ctx: Ctx): number {
  switch (action.kind) {
    case "finishTurn":
    case "passAction":
    case "passEndPhaseAction":
      return 0;
    case "skipBlock":
      return 5;
    case "activateBlocker":
      return 0;
    case "resolveTriggerOrder":
      return 1;
    case "resolveMulligan":
      return action.keep ? 10 : 0;
    case "resolveZoneOverflow": {
      const unit = byId(ctx.myUnits, action.instanceId);
      return 100 - (unit ? unitValue(unit, ctx.state) : 0);
    }
    case "resolveBurstDecision":
      return action.activate ? 0 : 5;
    case "resolveAbility": {
      const picks = action.resolutions.reduce((acc, r) => acc + (r.activate ? r.targetIds.length + 1 : 0), 0);
      return 5 + picks - index * 0.001;
    }
    case "declareAttack":
      return action.target === "player" ? 5 : -1;
    case "deployCard": {
      const card = byId(ctx.myHand, action.cardInstanceId);
      if (card && card.def.cardType === "UNIT" && !action.pairWithUnitId) return 10 - index * 0.001;
      return 3 - index * 0.001;
    }
    case "playCommand":
    case "activateAbility":
      return -10;
    default:
      return 0;
  }
}

export function chooseAction(
  view: ViewGameState,
  legal: LegalAction[],
  rng: Rng,
  level: HeuristicLevel = "normal",
): LegalAction {
  if (legal.length === 0) {
    throw new Error("heuristicPolicy: lista de ações legais vazia");
  }
  if (legal.length === 1) return legal[0];

  const ctx = buildCtx(view);
  const score = level === "facil" ? scoreFacil : scoreNormal;

  let best: LegalAction[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < legal.length; i++) {
    const value = score(legal[i], i, ctx);
    if (value > bestScore + 1e-9) {
      bestScore = value;
      best = [legal[i]];
    } else if (value > bestScore - 1e-9) {
      best.push(legal[i]);
    }
  }
  if (best.length === 1) return best[0];
  return best[Math.floor(rng() * best.length)];
}

export function heuristicPolicy(options: HeuristicPolicyOptions = {}): SelfPlayPolicy {
  const level = options.level ?? "normal";
  return (view, legal, rng) => chooseAction(view, legal, rng, level);
}
