import type { AttackTarget, CardDef, CardInstance, GameState, PlayerId } from "../types";
import { effectiveAp, effectiveHp, hasKeyword, otherPlayer, satisfiesLinkCondition } from "../types";
import type { ViewCardInstance, ViewGameState, ViewPlayerState } from "../viewState";
import type { LegalAction } from "../legalActions";
import type { Rng } from "../rng";
import type { SelfPlayPolicy } from "../selfPlay";
import { EffectLookahead, type EffectLookaheadConfig } from "./actionLookahead";
import { heuristicPolicy } from "./heuristicPolicy";
import { hasLethalLine, LETHAL_ATTACK_SCORE } from "./lethal";

export type ZeroSystemPersona = "amuro" | "char" | "heero" | "treize" | "adaptive";

export interface ZeroSystemPolicyOptions {
  persona?: ZeroSystemPersona;
  threatMultiplier?: number;
  /** lookahead de efeitos por simulação — mesmo contrato de `HeuristicPolicyOptions.lookahead` */
  lookahead?: EffectLookaheadConfig;
}

const LATE_GAME_TURN = 7;

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

interface ZeroCtx {
  view: ViewGameState;
  state: GameState;
  me: PlayerId;
  opp: PlayerId;
  myUnits: CardInstance[];
  oppUnits: CardInstance[];
  myBase: CardInstance | null;
  oppBase: CardInstance | null;
  myHand: CardInstance[];
  myShieldCount: number;
  oppShieldCount: number;
  myTotalAp: number;
  oppTotalAp: number;
  myReadyAp: number;
  oppReadyAp: number;
  resolvedPersona: "amuro" | "char" | "heero" | "treize";
  /** há linha letal neste turno (`hasLethalLine`), em qualquer persona */
  lethal: boolean;
  lookahead: EffectLookahead | null;
}

function resolveAdaptivePersona(
  myShields: number,
  oppShields: number,
  myReadyAp: number,
  oppReadyAp: number,
  myTotalAp: number,
  oppTotalAp: number,
  myBase: CardInstance | null,
  state: GameState,
): "amuro" | "char" | "heero" | "treize" {
  const myBaseHp = myBase ? remHp(myBase, state) : 0;
  // Perigo iminente de derrota -> Postura Defensiva / Controle (Amuro)
  if (myShields <= 2 || oppReadyAp >= myBaseHp + myShields * 3) {
    return "amuro";
  }
  // Oportunidade clara de letal ou pressão fulminante -> Postura Agressiva / Blitz (Char)
  if (oppShields <= 2 || myReadyAp >= 10) {
    return "char";
  }
  // Duelo aristocrático de forças de elite em equilíbrio de alta potência (Treize)
  if (myTotalAp >= 8 && oppTotalAp >= 8) {
    return "treize";
  }
  // Estado neutro ou equilibrado -> Cálculo Matemático de Objetivos (Heero)
  return "heero";
}

function buildZeroCtx(
  view: ViewGameState,
  legal: LegalAction[],
  persona: ZeroSystemPersona = "adaptive",
  lookahead: EffectLookahead | null = null,
): ZeroCtx {
  const me = view.viewer;
  const opp = otherPlayer(me);
  const myPlayer = view.players[me];
  const oppPlayer = view.players[opp];
  const state = asEngineState(view);

  const myUnits = realUnits(myPlayer);
  const oppUnits = realUnits(oppPlayer);
  const myBase = myPlayer.baseSection.filter(isReal)[0] ?? null;
  const oppBase = oppPlayer.baseSection.filter(isReal)[0] ?? null;

  const myTotalAp = myUnits.reduce((sum, u) => sum + effectiveAp(u, state), 0);
  const oppTotalAp = oppUnits.reduce((sum, u) => sum + effectiveAp(u, state), 0);
  const myReadyAp = myUnits.filter((u) => !u.rested).reduce((sum, u) => sum + effectiveAp(u, state), 0);
  const oppReadyAp = oppUnits.filter((u) => !u.rested).reduce((sum, u) => sum + effectiveAp(u, state), 0);

  const myShieldCount = myPlayer.counts.shields;
  const oppShieldCount = oppPlayer.counts.shields;

  const resolvedPersona =
    persona === "adaptive"
      ? resolveAdaptivePersona(myShieldCount, oppShieldCount, myReadyAp, oppReadyAp, myTotalAp, oppTotalAp, myBase, state)
      : persona;

  return {
    view,
    state,
    me,
    opp,
    myUnits,
    oppUnits,
    myBase,
    oppBase,
    myHand: myPlayer.hand.filter(isReal),
    myShieldCount,
    oppShieldCount,
    myTotalAp,
    oppTotalAp,
    myReadyAp,
    oppReadyAp,
    resolvedPersona,
    lethal: hasLethalLine(view, legal),
    lookahead,
  };
}

function actionTargetId(action: LegalAction): string | null {
  if ("targets" in action && action.targets) {
    const target = action.targets.target;
    if (target && target.length > 0) return target[0];
  }
  return null;
}

function targetBonus(ctx: ZeroCtx, id: string): number {
  const enemy = byId(ctx.oppUnits, id);
  if (enemy) {
    const ap = effectiveAp(enemy, ctx.state);
    const hp = remHp(enemy, ctx.state);
    const blockerWeight = hasKeyword(enemy, "Blocker", ctx.state) ? 8 : 0;
    const breachWeight = hasKeyword(enemy, "Breach", ctx.state) ? 6 : 0;
    return ap * 1.5 + hp + blockerWeight + breachWeight;
  }
  const friend = byId(ctx.myUnits, id);
  if (friend) return unitValue(friend, ctx.state) * 0.6;
  return 0;
}

function playerAttackWouldDoomBase(ctx: ZeroCtx, attacker: CardInstance): boolean {
  if (ctx.view.turnNumber >= LATE_GAME_TURN) return false;
  if (!ctx.myBase) return false;
  if (ctx.myShieldCount < 3) return false;
  if (!hasKeyword(attacker, "Blocker", ctx.state)) return false;

  const baseHpRem = remHp(ctx.myBase, ctx.state);
  const oppApTotal = ctx.oppUnits.reduce((sum, u) => sum + effectiveAp(u, ctx.state), 0);
  const otherBlockerHp = ctx.myUnits
    .filter((u) => u.instanceId !== attacker.instanceId && !u.rested && hasKeyword(u, "Blocker", ctx.state))
    .reduce((sum, u) => sum + remHp(u, ctx.state), 0);

  const survivesIfHeld = oppApTotal < baseHpRem + otherBlockerHp + remHp(attacker, ctx.state);
  const diesIfAttacks = oppApTotal >= baseHpRem + otherBlockerHp;
  return survivesIfHeld && diesIfAttacks;
}

// --- AMURO RAY (Controle, Preservação, Auras, Blocker) ---
function scoreBlockAmuro(ctx: ZeroCtx, blockerId: string): number {
  const combat = ctx.view.combat;
  if (!combat) return -5;
  const attacker = byId(ctx.oppUnits, combat.attackerId);
  const blocker = byId(ctx.myUnits, blockerId);
  if (!attacker || !blocker) return -5;

  const atkAp = effectiveAp(attacker, ctx.state);
  const blockerVal = unitValue(blocker, ctx.state);
  const blockerSurvives = remHp(blocker, ctx.state) > atkAp;
  const blockerKillsAtk = effectiveAp(blocker, ctx.state) >= remHp(attacker, ctx.state);

  const survivalBonus = blockerSurvives ? 12 : blockerKillsAtk ? 7 : 0;
  const target = combat.currentTarget;

  if (target !== "player") {
    const saved = byId(ctx.myUnits, target.unitId);
    if (!saved) return -5;
    const savedDies = remHp(saved, ctx.state) <= atkAp;
    const savedVal = unitValue(saved, ctx.state);
    if (savedDies && savedVal >= blockerVal) {
      return 18 + (savedVal - blockerVal) + survivalBonus;
    }
    return -2;
  }

  // Defendendo base ou escudos
  const baseInDanger = !!ctx.myBase && remHp(ctx.myBase, ctx.state) <= atkAp;
  const shieldsLow = ctx.myShieldCount <= 2;
  if (baseInDanger || shieldsLow) {
    return 15 + survivalBonus;
  }
  return blockerSurvives ? 8 : -3;
}

function scoreAttackAmuro(ctx: ZeroCtx, attackerId: string, target: AttackTarget): number {
  const attacker = byId(ctx.myUnits, attackerId);
  if (!attacker) return 0;
  const atkAp = effectiveAp(attacker, ctx.state);
  const atkHpRem = remHp(attacker, ctx.state);

  if (target === "player") {
    if (playerAttackWouldDoomBase(ctx, attacker)) return -10;
    // Se o atacante for blocker e o inimigo tem muitas unidades prontas, guarda
    if (hasKeyword(attacker, "Blocker", ctx.state) && ctx.oppUnits.length > ctx.myUnits.length) {
      return 4;
    }
    return 12 + atkAp;
  }

  const enemy = byId(ctx.oppUnits, target.unitId);
  if (!enemy) return 0;
  const enemyAp = effectiveAp(enemy, ctx.state);
  const enemyHpRem = remHp(enemy, ctx.state);
  const enemyVal = unitValue(enemy, ctx.state);
  const kills = atkAp >= enemyHpRem;
  const survives = enemyAp < atkHpRem;

  // Amuro prioriza trocas perfeitas onde sua unidade sobrevive
  if (kills && survives) return 45 + enemyVal;
  if (kills && !survives) {
    return enemyVal > unitValue(attacker, ctx.state) + 2 ? 22 : 5;
  }
  if (!survives) return -5;
  return 4;
}

// --- CHAR AZNABLE (Agressão Rápida, Pressão Direta, Breach) ---
function scoreBlockChar(ctx: ZeroCtx, blockerId: string): number {
  const combat = ctx.view.combat;
  if (!combat) return -5;
  const attacker = byId(ctx.oppUnits, combat.attackerId);
  const blocker = byId(ctx.myUnits, blockerId);
  if (!attacker || !blocker) return -5;

  const atkAp = effectiveAp(attacker, ctx.state);
  const blockerSurvives = remHp(blocker, ctx.state) > atkAp;
  const blockerKillsAtk = effectiveAp(blocker, ctx.state) >= remHp(attacker, ctx.state);

  // Char só bloqueia se o bloqueador matar o atacante ou se for letal inevitável
  if (ctx.myShieldCount === 0 && !ctx.myBase) return 20;
  if (blockerSurvives && blockerKillsAtk) return 14;
  if (blockerKillsAtk && unitValue(attacker, ctx.state) > unitValue(blocker, ctx.state)) return 8;
  return -2;
}

function scoreAttackChar(ctx: ZeroCtx, attackerId: string, target: AttackTarget): number {
  const attacker = byId(ctx.myUnits, attackerId);
  if (!attacker) return 0;
  const atkAp = effectiveAp(attacker, ctx.state);
  const atkHpRem = remHp(attacker, ctx.state);

  if (target === "player") {
    const breachBonus = hasKeyword(attacker, "Breach", ctx.state) ? 10 : 0;
    // Char foca no jogador com ímpeto implacável
    return 28 + 3 * atkAp + breachBonus;
  }

  const enemy = byId(ctx.oppUnits, target.unitId);
  if (!enemy) return 0;
  const enemyAp = effectiveAp(enemy, ctx.state);
  const enemyHpRem = remHp(enemy, ctx.state);
  const enemyVal = unitValue(enemy, ctx.state);
  const kills = atkAp >= enemyHpRem;
  const survives = enemyAp < atkHpRem;

  // Só ataca unidades inimigas se for para limpar blockers ou ameaças diretas
  const isBlocker = hasKeyword(enemy, "Blocker", ctx.state);
  if (isBlocker && kills) return 32 + (survives ? 10 : 0);
  if (kills && survives) return 25 + enemyVal;
  if (kills && !survives) return enemyVal >= unitValue(attacker, ctx.state) ? 15 : 2;
  return -3;
}

// --- HEERO YUY (Cálculo Frio do Zero System, Trocas Matemáticas Ótimas) ---
function scoreBlockHeero(ctx: ZeroCtx, blockerId: string): number {
  const combat = ctx.view.combat;
  if (!combat) return -5;
  const attacker = byId(ctx.oppUnits, combat.attackerId);
  const blocker = byId(ctx.myUnits, blockerId);
  if (!attacker || !blocker) return -5;

  const atkAp = effectiveAp(attacker, ctx.state);
  const atkHpRem = remHp(attacker, ctx.state);
  const blockerAp = effectiveAp(blocker, ctx.state);
  const blockerHpRem = remHp(blocker, ctx.state);

  const blockerSurvives = blockerHpRem > atkAp;
  const blockerKillsAtk = blockerAp >= atkHpRem;

  // Valor absoluto da troca
  const netAdvantage = (blockerKillsAtk ? unitValue(attacker, ctx.state) : 0) - (blockerSurvives ? 0 : unitValue(blocker, ctx.state));
  const target = combat.currentTarget;

  if (target === "player") {
    if (ctx.myShieldCount <= 1) return 25 + netAdvantage;
    return netAdvantage > 0 ? 12 + netAdvantage : -4;
  }

  const saved = byId(ctx.myUnits, target.unitId);
  if (!saved) return -5;
  const savedVal = unitValue(saved, ctx.state);
  const savedWouldDie = remHp(saved, ctx.state) <= atkAp;

  if (savedWouldDie) {
    const exchangeScore = savedVal + netAdvantage;
    return exchangeScore > 0 ? 15 + exchangeScore : -5;
  }
  return -5;
}

function scoreAttackHeero(ctx: ZeroCtx, attackerId: string, target: AttackTarget): number {
  const attacker = byId(ctx.myUnits, attackerId);
  if (!attacker) return 0;
  const atkAp = effectiveAp(attacker, ctx.state);
  const atkHpRem = remHp(attacker, ctx.state);

  if (target === "player") {
    return 18 + 2 * atkAp;
  }

  const enemy = byId(ctx.oppUnits, target.unitId);
  if (!enemy) return 0;
  const enemyAp = effectiveAp(enemy, ctx.state);
  const enemyHpRem = remHp(enemy, ctx.state);
  const enemyVal = unitValue(enemy, ctx.state);
  const kills = atkAp >= enemyHpRem;
  const survives = enemyAp < atkHpRem;

  // Razão de eficiência de combate: valor do alvo versus recurso consumido
  const atkVal = unitValue(attacker, ctx.state);
  if (kills && survives) return 40 + enemyVal;
  if (kills && !survives) {
    const delta = enemyVal - atkVal;
    return delta >= 0 ? 20 + delta * 2 : 4;
  }
  if (!survives) return -8;
  return 2;
}

// --- TREIZE KHUSHRENADA (Duelo Cavalheiresco, Combate Aristocrático de Elite) ---
function scoreBlockTreize(ctx: ZeroCtx, blockerId: string): number {
  const combat = ctx.view.combat;
  if (!combat) return -5;
  const attacker = byId(ctx.oppUnits, combat.attackerId);
  const blocker = byId(ctx.myUnits, blockerId);
  if (!attacker || !blocker) return -5;

  const atkAp = effectiveAp(attacker, ctx.state);
  const blockerAp = effectiveAp(blocker, ctx.state);
  const blockerSurvives = remHp(blocker, ctx.state) > atkAp;
  const blockerKillsAtk = blockerAp >= remHp(attacker, ctx.state);

  // Duelo honroso: bloqueia se abater o campeão inimigo com dignidade
  if (blockerKillsAtk && blockerSurvives) return 24;
  if (blockerKillsAtk) return 14;

  const baseInDanger = !!ctx.myBase && remHp(ctx.myBase, ctx.state) <= atkAp;
  if (baseInDanger || ctx.myShieldCount <= 1) return 16;

  return -4;
}

function scoreAttackTreize(ctx: ZeroCtx, attackerId: string, target: AttackTarget): number {
  const attacker = byId(ctx.myUnits, attackerId);
  if (!attacker) return 0;
  const atkAp = effectiveAp(attacker, ctx.state);
  const atkHpRem = remHp(attacker, ctx.state);
  const atkVal = unitValue(attacker, ctx.state);

  if (target === "player") {
    return 10 + atkAp * 1.5;
  }

  const enemy = byId(ctx.oppUnits, target.unitId);
  if (!enemy) return 0;
  const enemyAp = effectiveAp(enemy, ctx.state);
  const enemyHpRem = remHp(enemy, ctx.state);
  const enemyVal = unitValue(enemy, ctx.state);
  const kills = atkAp >= enemyHpRem;
  const survives = enemyAp < atkHpRem;

  // Duelo nobre: busca desmantelar os campeões mais fortes do adversário
  const elitePrestige = enemyAp * 2 + (enemy.def.level ?? 0) * 2;
  if (kills && survives) return 42 + enemyVal + elitePrestige;
  if (kills && !survives) {
    const delta = enemyVal - atkVal;
    return delta >= 0 ? 22 + delta * 2 + elitePrestige : 6;
  }
  if (!survives) return -6;
  return 3;
}

function scoreDeployZero(ctx: ZeroCtx, action: Extract<LegalAction, { kind: "deployCard" }>): number {
  const card = byId(ctx.myHand, action.cardInstanceId);
  if (!card) return 10;
  const def = card.def;

  if (action.pairWithUnitId) {
    const unit = byId(ctx.myUnits, action.pairWithUnitId);
    const formsLink = !!unit && satisfiesLinkCondition(pilotDefForLink(card), unit.def);
    const pilotStats = (def.pilotMode?.ap ?? def.ap ?? 0) + (def.pilotMode?.hp ?? def.hp ?? 0);
    return 26 + pilotStats + (formsLink ? 18 : 0);
  }

  if (def.cardType === "UNIT") {
    const stats = (def.ap ?? 0) + (def.hp ?? 0);
    const isBlocker = def.effectKeywords?.includes("Blocker") ?? false;
    const isBreach = def.effectKeywords?.includes("Breach") ?? false;

    let personaBonus = 0;
    if (ctx.resolvedPersona === "amuro" && isBlocker) personaBonus += 12;
    if (ctx.resolvedPersona === "char" && (isBreach || (def.ap ?? 0) >= 4)) personaBonus += 10;
    if (ctx.resolvedPersona === "heero") personaBonus += stats >= 7 ? 8 : 4;
    if (ctx.resolvedPersona === "treize" && ((def.ap ?? 0) >= 4 || (def.level ?? 0) >= 5)) personaBonus += 12;

    return 28 + stats + personaBonus - 3 * ctx.myUnits.length;
  }

  if (def.cardType === "BASE") {
    return ctx.myBase ? 3 : 22;
  }

  return 10;
}

function scoreZeroAction(action: LegalAction, _index: number, ctx: ZeroCtx): number {
  switch (action.kind) {
    case "finishTurn":
    case "passAction":
    case "passEndPhaseAction":
      return 0;
    case "skipBlock":
      return ctx.resolvedPersona === "amuro" ? -2 : 0;
    case "resolveTriggerOrder":
      return 1;
    case "resolveMulligan": {
      const keepGood = ctx.myHand.some((c) => c.def.cardType === "UNIT" && (c.def.level ?? 99) <= 2);
      if (action.keep) return keepGood ? 12 : 1;
      return keepGood ? 0 : 12;
    }
    case "resolveZoneOverflow": {
      const unit = byId(ctx.myUnits, action.instanceId);
      return 100 - (unit ? unitValue(unit, ctx.state) : 0);
    }
    case "resolveBurstDecision": {
      if (!action.activate) return 1;
      const id = actionTargetId(action);
      return 15 + (id ? targetBonus(ctx, id) : 0);
    }
    case "resolveAbility": {
      const activated = action.resolutions.filter((r) => r.activate);
      if (activated.length === 0) return 2;
      let score = 6 * activated.length;
      for (const r of activated) {
        if (r.targetIds.length > 0) {
          score += 12 * r.targetIds.length;
          for (const id of r.targetIds) score += targetBonus(ctx, id);
        }
      }
      return score;
    }
    case "activateBlocker": {
      if (ctx.resolvedPersona === "amuro") return scoreBlockAmuro(ctx, action.blockerId);
      if (ctx.resolvedPersona === "char") return scoreBlockChar(ctx, action.blockerId);
      if (ctx.resolvedPersona === "treize") return scoreBlockTreize(ctx, action.blockerId);
      return scoreBlockHeero(ctx, action.blockerId);
    }
    case "declareAttack": {
      if (ctx.lethal && action.target === "player") {
        const attacker = byId(ctx.myUnits, action.attackerId);
        return LETHAL_ATTACK_SCORE + (attacker ? effectiveAp(attacker, ctx.state) : 0);
      }
      if (ctx.resolvedPersona === "amuro") return scoreAttackAmuro(ctx, action.attackerId, action.target);
      if (ctx.resolvedPersona === "char") return scoreAttackChar(ctx, action.attackerId, action.target);
      if (ctx.resolvedPersona === "treize") return scoreAttackTreize(ctx, action.attackerId, action.target);
      return scoreAttackHeero(ctx, action.attackerId, action.target);
    }
    case "deployCard":
      return scoreDeployZero(ctx, action);
    case "playCommand":
    case "activateAbility": {
      const id = actionTargetId(action);
      const enemy = id ? byId(ctx.oppUnits, id) : undefined;
      const legacy = enemy ? 10 + unitValue(enemy, ctx.state) * 1.5 : -1;
      return ctx.lookahead ? ctx.lookahead.score(ctx.view, action, legacy) : legacy;
    }
    default:
      return 0;
  }
}

export function chooseZeroSystemAction(
  view: ViewGameState,
  legal: LegalAction[],
  rng: Rng,
  options: ZeroSystemPolicyOptions = {},
  lookahead: EffectLookahead | null = null,
): LegalAction {
  if (legal.length === 0) {
    throw new Error("zeroSystemPolicy: lista de ações legais vazia");
  }
  if (legal.length === 1) return legal[0];

  lookahead?.beginDecision();
  const ctx = buildZeroCtx(view, legal, options.persona ?? "adaptive", lookahead);

  let best: LegalAction[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < legal.length; i++) {
    const value = scoreZeroAction(legal[i], i, ctx);
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

export function zeroSystemPolicy(options: ZeroSystemPolicyOptions = {}): SelfPlayPolicy {
  const lookahead = options.lookahead ? new EffectLookahead(options.lookahead, heuristicPolicy({ level: "normal" })) : null;
  return (view, legal, rng) => {
    const choice = chooseZeroSystemAction(view, legal, rng, options, lookahead);
    lookahead?.record(view.turnNumber, choice);
    return choice;
  };
}
