import type { EffectContext, PredicateResolver, TargetFilterResolver } from "../engine/effectSpec";
import { findCard } from "../engine/events";
import {
  effectiveAp,
  effectiveHp,
  effectivePilotDef,
  otherPlayer,
  satisfiesLinkCondition,
  type CardInstance,
  type GameState,
} from "../engine/types";

/**
 * `PredicateResolver` canônico pros predicados de `condition` já usados nos
 * EffectSpec reais de ST01/ST02 (docs/18, passo 3). Até agora só existe 1
 * família de predicado em uso — `pairedPilotHasTrait:<trait>` (ST01-002
 * Gundam MA Form, 【When Paired】) — mas isso ficava reimplementado ad-hoc
 * dentro de cada arquivo de teste que precisava disparar esse EffectSpec
 * (`st01VsSt02Match.test.ts`). Extraído aqui pra ser a MESMA função usada
 * pelos testes e pelo dispatcher real do servidor (`server/matchStore.ts`),
 * em vez de arriscar duas implementações divergentes do mesmo predicado.
 *
 * Novos predicados (se/quando aparecerem em cartas futuras) entram aqui,
 * não em mais um resolver local duplicado.
 */
export const defaultPredicateResolver: PredicateResolver = (predicate, ctx: EffectContext) => {
  // Composição E lógico entre 2+ predicados simples (ex.: GD01-050 Anksha —
  // "If this Unit has 5 or more AP and it is attacking an enemy Unit, ..." ->
  // "selfApAtLeast:5;attackingEnemyUnit"). Mesma convenção do target filter
  // composto em `defaultTargetFilterResolver`.
  if (predicate.includes(";")) {
    return predicate.split(";").every((clause) => defaultPredicateResolver(clause, ctx));
  }
  // GD01-050 LaGOWE — 【Attack】"... it is attacking an enemy Unit, ...".
  if (predicate === "attackingEnemyUnit") {
    const target = ctx.state.combat?.originalTarget;
    return typeof target === "object" && target !== null;
  }
  // GD01-059 Zee Zulu — 【Attack】"If you are attacking the enemy player, ...".
  if (predicate === "attackingPlayer") {
    return ctx.state.combat?.originalTarget === "player";
  }
  const pairedPilotHasTrait = predicate.match(/^pairedPilotHasTrait:(.+)$/);
  if (pairedPilotHasTrait) {
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    if (!source.pairedPilotId) return false;
    const pilot = findCard(ctx.state, source.pairedPilotId);
    return pilot.def.traits?.includes(pairedPilotHasTrait[1]) ?? false;
  }
  // ST02-016 Corsica Base — "if ... a card with 'Corsica Base' in its card name is in your trash".
  const cardInTrashNamed = predicate.match(/^cardInTrashNamed:(.+)$/);
  if (cardInTrashNamed) {
    return ctx.state.players[ctx.controller].trash.some((c) => c.def.nameEn.includes(cardInTrashNamed[1]));
  }
  // ST04-006 Aegis Gundam — 【Attack】"If this Unit has 5 or more AP, ...".
  const selfApAtLeast = predicate.match(/^selfApAtLeast:(\d+)$/);
  if (selfApAtLeast) {
    return effectiveAp(findCard(ctx.state, ctx.sourceInstanceId), ctx.state) >= Number(selfApAtLeast[1]);
  }
  // ST04-009 Miguel's Ginn — 【Destroyed】"If you have another Link Unit in play, draw 1."
  // "another" = qualquer Link Unit amiga na Battle Area que NÃO seja a fonte.
  if (predicate === "controllerHasOtherLinkUnit") {
    const owner = ctx.state.players[ctx.controller];
    return owner.battleArea.some((u) => u.instanceId !== ctx.sourceInstanceId && u.def.cardType === "UNIT" && isPairedLinkUnit(ctx.state, u));
  }
  // GD01-007 Noin's Aries — 【Destroyed】"If you have another (OZ) Unit in play, draw 1."
  const controllerOtherUnitWithTrait = predicate.match(/^controllerOtherUnitWithTrait:(.+)$/);
  if (controllerOtherUnitWithTrait) {
    const owner = ctx.state.players[ctx.controller];
    return owner.battleArea.some(
      (u) => u.instanceId !== ctx.sourceInstanceId && u.def.cardType === "UNIT" && (u.def.traits ?? []).includes(controllerOtherUnitWithTrait[1]),
    );
  }
  // GD01-047 Shamblo — 【Attack】"If 2 or more other rested friendly Units are in play, ...".
  const controllerOtherRestedUnitCountAtLeast = predicate.match(/^controllerOtherRestedUnitCountAtLeast:(\d+)$/);
  if (controllerOtherRestedUnitCountAtLeast) {
    const owner = ctx.state.players[ctx.controller];
    const count = owner.battleArea.filter(
      (u) => u.instanceId !== ctx.sourceInstanceId && u.def.cardType === "UNIT" && u.rested,
    ).length;
    return count >= Number(controllerOtherRestedUnitCountAtLeast[1]);
  }
  // GD01-097 Guel Jeturk — 【Activate･Main】"If your opponent has 8 or more cards in their hand, ...".
  const opponentHandCountAtLeast = predicate.match(/^opponentHandCountAtLeast:(\d+)$/);
  if (opponentHandCountAtLeast) {
    return ctx.state.players[otherPlayer(ctx.controller)].hand.length >= Number(opponentHandCountAtLeast[1]);
  }
  // GD01-098 Elan Ceres — 【Activate･Action】"If an enemy Unit with 1 or less AP is in play, ...".
  const enemyUnitExistsWithApAtMost = predicate.match(/^enemyUnitExistsWithApAtMost:(\d+)$/);
  if (enemyUnitExistsWithApAtMost) {
    const opponent = ctx.state.players[otherPlayer(ctx.controller)];
    return opponent.battleArea.some(
      (u) => u.def.cardType === "UNIT" && effectiveAp(u, ctx.state) <= Number(enemyUnitExistsWithApAtMost[1]),
    );
  }
  // GD01-125 Zanzibar — 【Deploy】"Then, if it is your turn, you may deploy ...".
  if (predicate === "isControllersTurn") {
    return ctx.state.activePlayer === ctx.controller;
  }
  // GD01-130 13th Tactical Testing Sector — 【Activate･Main】"If a friendly (Academy) Unit is in play, ...".
  const controllerUnitWithTraitInPlay = predicate.match(/^controllerUnitWithTraitInPlay:(.+)$/);
  if (controllerUnitWithTraitInPlay) {
    const owner = ctx.state.players[ctx.controller];
    return owner.battleArea.some((u) => u.def.cardType === "UNIT" && (u.def.traits ?? []).includes(controllerUnitWithTraitInPlay[1]));
  }
  // ST03-011 Char Aznable — 【Attack】"if it is a Link Unit" — a fonte é o Pilot,
  // "this Unit" é a Unit pareada com ele.
  if (predicate === "sourcePairedUnitIsLinkUnit") {
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    if (source.def.cardType === "UNIT") return isPairedLinkUnit(ctx.state, source);
    if (!source.pairedUnitId) return false;
    return isPairedLinkUnit(ctx.state, findCard(ctx.state, source.pairedUnitId));
  }
  // ST04-012 Striker Pack — "If you have no (X) Unit tokens in play, ...".
  const noTokenWithTrait = predicate.match(/^noControllerUnitTokenWithTrait:(.+)$/);
  if (noTokenWithTrait) {
    const owner = ctx.state.players[ctx.controller];
    return !owner.battleArea.some((c) => c.def.isToken && c.def.cardType === "UNIT" && (c.def.traits ?? []).includes(noTokenWithTrait[1]));
  }
  // ST04-001 Aile Strike Gundam — 【When Paired･Lv.4 or Higher Pilot】.
  const pairedPilotLevelAtLeast = predicate.match(/^pairedPilotLevelAtLeast:(\d+)$/);
  if (pairedPilotLevelAtLeast) {
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    if (!source.pairedPilotId) return false;
    const pilot = findCard(ctx.state, source.pairedPilotId);
    return (effectivePilotDef(pilot).level ?? 0) >= Number(pairedPilotLevelAtLeast[1]);
  }
  // GD01-038 Adzam — 【Deploy】"If 5 or more enemy Units are in play, ...".
  const enemyUnitCountAtLeast = predicate.match(/^enemyUnitCountAtLeast:(\d+)$/);
  if (enemyUnitCountAtLeast) {
    const opponent = ctx.state.players[otherPlayer(ctx.controller)];
    return opponent.battleArea.filter((c) => c.def.cardType === "UNIT").length >= Number(enemyUnitCountAtLeast[1]);
  }
  // GD01-001 Gundam — 【When Paired】"If you have 2 or more other Units in play, draw 1."
  // ("other" = qualquer Unit amiga na Battle Area que não seja a própria fonte).
  const controllerOtherUnitCountAtLeast = predicate.match(/^controllerOtherUnitCountAtLeast:(\d+)$/);
  if (controllerOtherUnitCountAtLeast) {
    const owner = ctx.state.players[ctx.controller];
    const count = owner.battleArea.filter((c) => c.instanceId !== ctx.sourceInstanceId && c.def.cardType === "UNIT").length;
    return count >= Number(controllerOtherUnitCountAtLeast[1]);
  }
  // GD01-073 Sword Strike Gundam — 【During Link】【Attack】"...". A fonte É a Unit
  // (diferente de `sourcePairedUnitIsLinkUnit`, que é pro caso do Pilot ter o campo).
  if (predicate === "selfIsLinkUnit") {
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    return isPairedLinkUnit(ctx.state, source);
  }
  // GD01-082 Gundam Aerial (Mirasoul Flight Unit) — 【During Pair】【Activate･Action】"...".
  // Mais simples que `selfIsLinkUnit`: só checa se a Unit fonte tem Pilot pareado agora.
  if (predicate === "selfIsPaired") {
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    return !!source.pairedPilotId;
  }
  // GD01-027 Big Zam — 【Deploy】"If there are 10 or more (Zeon)/(Neo Zeon) Unit
  // cards in your trash, ...". Traits em lista separada por vírgula (OR entre
  // eles, não AND — "(Zeon)/(Neo Zeon)" no texto oficial é uma cor com 2 nomes
  // de trait possíveis, nunca as 2 ao mesmo tempo na mesma carta).
  const controllerTrashUnitCountWithAnyTraitAtLeast = predicate.match(/^controllerTrashUnitCountWithAnyTraitAtLeast:(.+):(\d+)$/);
  if (controllerTrashUnitCountWithAnyTraitAtLeast) {
    const traits = controllerTrashUnitCountWithAnyTraitAtLeast[1].split(",");
    const min = Number(controllerTrashUnitCountWithAnyTraitAtLeast[2]);
    const count = ctx.state.players[ctx.controller].trash.filter(
      (c) => c.def.cardType === "UNIT" && (c.def.traits ?? []).some((t) => traits.includes(t)),
    ).length;
    return count >= min;
  }
  return false;
};

/** Uma Unit é "Link Unit" se tem Pilot pareado que satisfaz a link condition (mesma regra de `isLinkUnit` em effectSpec.ts / combat.ts). */
function isPairedLinkUnit(state: GameState, unit: CardInstance): boolean {
  if (!unit.pairedPilotId) return false;
  const pilot = findCard(state, unit.pairedPilotId);
  return satisfiesLinkCondition(effectivePilotDef(pilot), unit.def);
}

/** HP restante de verdade — HP efetivo (com buff/`During Pair`) menos o dano acumulado. Mesmo cálculo de `CardInspectorPanel`. */
function remainingHp(card: CardInstance, state: GameState): number {
  return Math.max(0, effectiveHp(card, state) - card.damage);
}

/**
 * `TargetFilterResolver` canônico (V0, docs/25) — mesmo espírito do
 * `defaultPredicateResolver` acima, só que resolvido POR CANDIDATO em vez de
 * pelo `EffectContext` inteiro. 3 famílias em uso hoje pelas cartas reais de
 * ST01/ST02 — `hp<=N` (Guntank/Amuro Ray/Siege Ploy), `level<=N` (Aerial
 * Score Six) e `rested` (Thoroughly Damaged, Suletta Mercury). Novo filtro
 * (carta futura) entra aqui, nunca como um hack local na UI.
 */
export const defaultTargetFilterResolver: TargetFilterResolver = (filter, candidate, ctx) => {
  // Composição E lógico entre 2+ filtros simples (ex.: GD01-049 Blitz Gundam —
  // "1 of your (ZAFT) Units with 5 or more AP" -> "trait:ZAFT;ap>=5"). Cada
  // cláusula usa as MESMAS regras abaixo — nenhum operador novo, só "todas
  // as cláusulas precisam passar".
  if (filter.includes(";")) {
    return filter.split(";").every((clause) => defaultTargetFilterResolver(clause, candidate, ctx));
  }

  const hpAtMost = filter.match(/^hp<=(\d+)$/);
  if (hpAtMost) return remainingHp(candidate, ctx.state) <= Number(hpAtMost[1]);

  const levelAtMost = filter.match(/^level<=(\d+)$/);
  if (levelAtMost) return (candidate.def.level ?? 0) <= Number(levelAtMost[1]);

  // ST04-006 Aegis Gundam — "enemy Unit that is Lv.5 or higher".
  const levelAtLeast = filter.match(/^level>=(\d+)$/);
  if (levelAtLeast) return (candidate.def.level ?? 0) >= Number(levelAtLeast[1]);

  // ST03-015 Rewloola — "enemy Unit with 5 or less AP".
  const apAtMost = filter.match(/^ap<=(\d+)$/);
  if (apAtMost) return effectiveAp(candidate, ctx.state) <= Number(apAtMost[1]);

  // ST04-015 Archangel — "friendly Unit with <Blocker>".
  const hasKw = filter.match(/^hasKeyword:(.+)$/);
  if (hasKw) return (candidate.def.effectKeywords ?? []).includes(hasKw[1]) || candidate.keywordGrants.some((g) => g.keyword === hasKw[1]);

  // GD01-049 Blitz Gundam — "1 of your (ZAFT) Units with 5 or more AP" (trait, sempre em composição com outro filtro via ";").
  const traitMatch = filter.match(/^trait:(.+)$/);
  if (traitMatch) return (candidate.def.traits ?? []).includes(traitMatch[1]);

  // GD01-049 Blitz Gundam — companion do filtro de trait acima.
  const apAtLeast = filter.match(/^ap>=(\d+)$/);
  if (apAtLeast) return effectiveAp(candidate, ctx.state) >= Number(apAtLeast[1]);

  if (filter === "rested") return candidate.rested;

  // GD01-101 Deep Devotion — "1 friendly Link Unit".
  if (filter === "linkUnit") return isPairedLinkUnit(ctx.state, candidate);

  // GD01-069 Strike Rouge — "1 of your rested white Units with <Blocker>" (cor impressa da carta, não trait).
  const colorMatch = filter.match(/^color:(.+)$/);
  if (colorMatch) return candidate.def.color === colorMatch[1];

  return false;
};
