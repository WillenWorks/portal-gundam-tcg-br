/* P3 — decide se uma carta da mão pode ser jogada AGORA, considerando regras +
 * campo: nível (recursos em campo), custo (recursos active), fase (Main vs
 * Action Step), Unit amiga sem Piloto pra parear, e alvo legal quando o efeito
 * exige um. Puro/testável — o `SimulatorMatchPage` passa o contexto derivado do
 * `ViewGameState`.
 *
 * V0 (docs/25): "alvo legal" usa a MESMA `computeLegalTargets` do servidor
 * (escopo + `targetFilter` — HP/nível/descansada/etc.), não mais uma contagem
 * bruta por categoria ampla — antes disso, um Command tipo Siege Ploy ("Choose
 * 1 enemy Unit with 5 or less HP") aparecia jogável mesmo sem NENHUMA Unit
 * inimiga dentro do HP exigido, só por existir alguma Unit inimiga qualquer. */
import { ALL_EFFECT_SPECS, defaultTargetFilterResolver } from "../content";
import { computeLegalTargets, specNeedsNamedTarget } from "../engine/effectSpec";
import type { CardDef, GameState, PlayerId } from "../engine/types";

export interface PlayabilityContext {
  /** Main Phase própria, sem combate. */
  myTurnMain: boolean;
  /** tem prioridade num Action Step (combate ou fim de turno). */
  inActionStep: boolean;
  /** recursos active (não-rested) na Resource Area própria. */
  activeResources: number;
  /** total de recursos em campo (active + rested). */
  totalResources: number;
  /** existe ≥ 1 Unit amiga na Battle Area SEM Piloto pareado. */
  hasUnpairedFriendlyUnit: boolean;
  /** estado atual (a `ViewGameState` já dá pra ler zonas públicas — cast feito pelo caller) + de quem é o turno de jogar, pra `computeLegalTargets`. */
  state: GameState;
  controller: PlayerId;
}

/** true se pelo menos 1 EffectSpec de `trigger` da carta precisa de alvo e NÃO há alvo LEGAL agora (escopo + filtro). */
function blockedByMissingTarget(code: string, trigger: string, ctx: PlayabilityContext): boolean {
  return ALL_EFFECT_SPECS.some((s) => {
    if (s.cardCode !== code || s.trigger !== trigger || !specNeedsNamedTarget(s)) return false;
    return computeLegalTargets(ctx.state, s, ctx.controller, defaultTargetFilterResolver).length === 0;
  });
}

/** Modos de jogo possíveis AGORA. Vazio = injogável (carta fica esmaecida). */
export function playableModes(def: CardDef, ctx: PlayabilityContext): Array<"deploy" | "commandMain" | "commandAction"> {
  if (ctx.activeResources < (def.cost ?? 0) || ctx.totalResources < (def.level ?? 0)) return [];

  const modes: Array<"deploy" | "commandMain" | "commandAction"> = [];
  const isPilotLike = def.cardType === "PILOT" || !!def.pilotMode;

  if (def.cardType === "UNIT" && ctx.myTurnMain) modes.push("deploy");
  // Parear Piloto (nativo ou Command/Pilot no modo Piloto) — precisa de Unit amiga livre.
  if (isPilotLike && ctx.myTurnMain && ctx.hasUnpairedFriendlyUnit) modes.push("deploy");

  if (def.cardType === "COMMAND") {
    const kw = def.triggerKeywords ?? [];
    if (kw.includes("Main") && ctx.myTurnMain && !blockedByMissingTarget(def.code, "Main", ctx)) modes.push("commandMain");
    if (kw.includes("Action") && ctx.inActionStep && !blockedByMissingTarget(def.code, "Action", ctx)) modes.push("commandAction");
  }

  return modes;
}

export function isPlayableNow(def: CardDef, ctx: PlayabilityContext): boolean {
  return playableModes(def, ctx).length > 0;
}
