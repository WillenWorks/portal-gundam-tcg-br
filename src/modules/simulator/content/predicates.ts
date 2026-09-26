import type { EffectContext, PredicateResolver, TargetFilterResolver } from "../engine/effectSpec";
import { findCard } from "../engine/events";
import {
  effectiveAp,
  effectiveHp,
  effectivePilotDef,
  hasKeyword,
  isActingAsPilot,
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
  // GD01-044 Kshatriya — 【When Paired･(Cyber-Newtype)/(Newtype) Pilot】 — OR entre traits
  // (mesma convenção de vírgula de `controllerTrashUnitCountWithAnyTraitAtLeast`).
  const pairedPilotHasAnyTrait = predicate.match(/^pairedPilotHasAnyTrait:(.+)$/);
  if (pairedPilotHasAnyTrait) {
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    if (!source.pairedPilotId) return false;
    const pilot = findCard(ctx.state, source.pairedPilotId);
    const traits = pairedPilotHasAnyTrait[1].split(",");
    return (pilot.def.traits ?? []).some((t) => traits.includes(t));
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
  // ST06-014 Clan Battle — 【Activate･Main】"If a friendly (Clan) Link Unit is in play, ...".
  const controllerLinkUnitWithTraitInPlay = predicate.match(/^controllerLinkUnitWithTraitInPlay:(.+)$/);
  if (controllerLinkUnitWithTraitInPlay) {
    const owner = ctx.state.players[ctx.controller];
    return owner.battleArea.some((u) => u.def.cardType === "UNIT" && (u.def.traits ?? []).includes(controllerLinkUnitWithTraitInPlay[1]) && isPairedLinkUnit(ctx.state, u));
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
  // GD01-023 Char's Gelgoog — 【Activate･Main】"If a Pilot is not paired with this Unit, ...".
  if (predicate === "selfNotPaired") {
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    return !source.pairedPilotId;
  }
  // GD01-027 Big Zam — 【Deploy】"If there are 10 or more (Zeon)/(Neo Zeon) Unit
  // cards in your trash, ...". Traits em lista separada por vírgula (OR entre
  // eles, não AND — "(Zeon)/(Neo Zeon)" no texto oficial é uma cor com 2 nomes
  // de trait possíveis, nunca as 2 ao mesmo tempo na mesma carta).
  // GD02-061 Hyakuri — "3 or more (Teiwaz)/(Tekkadan) CARDS in your trash" (qualquer tipo, OR entre traits).
  const controllerTrashCardCountWithAnyTraitAtLeast = predicate.match(/^controllerTrashCardCountWithAnyTraitAtLeast:(.+):(\d+)$/);
  if (controllerTrashCardCountWithAnyTraitAtLeast) {
    const traits = controllerTrashCardCountWithAnyTraitAtLeast[1].split(",");
    return (
      ctx.state.players[ctx.controller].trash.filter((c) => (c.def.traits ?? []).some((t) => traits.includes(t))).length >=
      Number(controllerTrashCardCountWithAnyTraitAtLeast[2])
    );
  }
  // GD02-003 Gundam Mk-II (Titans) — 【During Pair･Lv.3 or Lower Pilot】: nível do Piloto que ESTAVA pareado.
  const formerPairedPilotLevelAtMost = predicate.match(/^formerPairedPilotLevelAtMost:(\d+)$/);
  if (formerPairedPilotLevelAtMost) {
    const pilotId = ctx.targets.formerPairedPilot?.[0];
    return !!pilotId && (findCard(ctx.state, pilotId).def.level ?? 0) <= Number(formerPairedPilotLevelAtMost[1]);
  }
  const controllerTrashUnitCountWithAnyTraitAtLeast = predicate.match(/^controllerTrashUnitCountWithAnyTraitAtLeast:(.+):(\d+)$/);
  if (controllerTrashUnitCountWithAnyTraitAtLeast) {
    const traits = controllerTrashUnitCountWithAnyTraitAtLeast[1].split(",");
    const min = Number(controllerTrashUnitCountWithAnyTraitAtLeast[2]);
    const count = ctx.state.players[ctx.controller].trash.filter(
      (c) => c.def.cardType === "UNIT" && (c.def.traits ?? []).some((t) => traits.includes(t)),
    ).length;
    return count >= min;
  }
  // ST05-012 McGillis Fareed — 【When Paired】"If you have 2 or more other
  // (Gjallarhorn)/(Tekkadan) Units in play, ...". Mesma convenção de OR entre
  // traits de `controllerTrashUnitCountWithAnyTraitAtLeast`, só que na Battle
  // Area (não no trash) e excluindo a própria fonte ("other").
  const controllerOtherUnitCountWithAnyTraitAtLeast = predicate.match(/^controllerOtherUnitCountWithAnyTraitAtLeast:(.+):(\d+)$/);
  if (controllerOtherUnitCountWithAnyTraitAtLeast) {
    const traits = controllerOtherUnitCountWithAnyTraitAtLeast[1].split(",");
    const min = Number(controllerOtherUnitCountWithAnyTraitAtLeast[2]);
    const owner = ctx.state.players[ctx.controller];
    const count = owner.battleArea.filter(
      (c) =>
        c.instanceId !== ctx.sourceInstanceId &&
        c.def.cardType === "UNIT" &&
        (c.def.traits ?? []).some((t) => traits.includes(t)),
    ).length;
    return count >= min;
  }
  // GD01-095 Dearka Elthman — "Discard 1. If you do, draw 1." Lote 5 (docs/debates
  // 2026-09-13): "if you do" = a escolha nomeada `<key>` (já resolvida ANTES de
  // `resolveEffectSpec` rodar, pela camada de decisão) não veio vazia — não é
  // "resultado de uma primitiva anterior" de verdade, é a MESMA escolha que a
  // primitiva vai consumir (ex.: `discardNamed` com `name:"discard"` — se a mão
  // tava vazia, `handDiscard.legalHandIds` já teria sido `[]`, então a escolha
  // também é `[]`; "if you do" == "se a escolha não é vazia").
  const chosenNonEmpty = predicate.match(/^chosenNonEmpty:(.+)$/);
  if (chosenNonEmpty) return (ctx.targets[chosenNonEmpty[1]] ?? []).length > 0;
  // GD01-003 — "Choose 12 cards from your trash... If you do, ...". Diferente de
  // `chosenNonEmpty` (checa uma ESCOLHA já feita): aqui não há escolha de jogador, só
  // estado de board ANTES da própria primitiva `returnTrashToDeckAndShuffle` rodar
  // (avaliado antes por causa da ordem cost->condition->actions de resolveEffectSpec).
  const controllerTrashCountAtLeast = predicate.match(/^controllerTrashCountAtLeast:(\d+)$/);
  if (controllerTrashCountAtLeast) {
    return ctx.state.players[ctx.controller].trash.length >= Number(controllerTrashCountAtLeast[1]);
  }
  // ST07-001/009 — "if there are 7 or more (CB) cards in your trash"
  const controllerTrashCardCountWithTraitAtLeast = predicate.match(/^controllerTrashCardCountWithTraitAtLeast:(.+):(\d+)$/);
  if (controllerTrashCardCountWithTraitAtLeast) {
    const trait = controllerTrashCardCountWithTraitAtLeast[1];
    const min = Number(controllerTrashCardCountWithTraitAtLeast[2]);
    const count = ctx.state.players[ctx.controller].trash.filter((c) => (c.def.traits ?? []).includes(trait)).length;
    return count >= min;
  }
  // ST08-006 Penelope — 【During Pair】【Attack】"reveal 1 (Earth Federation) Unit
  // card from your hand... If you do, draw 2." Checa se existe pelo menos 1
  // Unit com o trait na mão ANTES da própria ação de revelar/mover rodar —
  // mesma ordem cost->condition->actions de `controllerTrashCountAtLeast`
  // acima. Sem escolha interativa de QUAL carta (não existe `targetScope`
  // pra mão ainda) — a ação que consome isto usa sempre a primeira que casar
  // (mesma simplificação documentada de `returnTrashToDeckAndShuffle`).
  const controllerHandHasUnitWithTrait = predicate.match(/^controllerHandHasUnitWithTrait:(.+)$/);
  if (controllerHandHasUnitWithTrait) {
    const trait = controllerHandHasUnitWithTrait[1];
    return ctx.state.players[ctx.controller].hand.some(
      (c) => c.def.cardType === "UNIT" && (c.def.traits ?? []).includes(trait),
    );
  }
  // GD03-001 Gundam NT-1 — 【When Paired】"Deal 1 damage to it. When this effect
  // destroys an enemy Unit, draw 1." Mesma matemática que `damageUnit` já usa
  // pra decidir sozinho se dispara `DESTROY_CARD` (effectSpec.ts, case
  // "damageUnit": `card.damage + amount >= effectiveHp(...)`) — repetida aqui
  // pra virar um predicate de `condition`, avaliado ANTES do dano rodar
  // (mesma ordem cost->condition->actions; o resultado não muda porque é a
  // MESMA fórmula, só calculada 1x a mais).
  const namedTargetLethalDamage = predicate.match(/^namedTargetLethalDamage:(.+):(\d+)$/);
  if (namedTargetLethalDamage) {
    const targetId = ctx.targets[namedTargetLethalDamage[1]]?.[0];
    if (!targetId) return false;
    const card = findCard(ctx.state, targetId);
    return card.damage + Number(namedTargetLethalDamage[2]) >= effectiveHp(card, ctx.state);
  }
  // ST08-013 Lady Luck — "If a friendly (Mafty) Link Unit is in play"
  const controllerHasLinkUnitWithTrait = predicate.match(/^controllerHasLinkUnitWithTrait:(.+)$/);
  if (controllerHasLinkUnitWithTrait) {
    const trait = controllerHasLinkUnitWithTrait[1];
    return ctx.state.players[ctx.controller].battleArea.some(
      (u) => u.def.cardType === "UNIT" && (u.def.traits ?? []).includes(trait) && isPairedLinkUnit(ctx.state, u),
    );
  }
  // ST07-010 Tieria Erde — "If it is your opponent's turn"
  if (predicate === "isOpponentTurn") {
    return ctx.state.activePlayer !== ctx.controller;
  }
  // ST07-004 Virtue / ST07-007 Kyrios — "while you have a (CB) Pilot in play"
  const controllerHasPilotWithTrait = predicate.match(/^controllerHasPilotWithTrait:(.+)$/);
  if (controllerHasPilotWithTrait) {
    const trait = controllerHasPilotWithTrait[1];
    return ctx.state.players[ctx.controller].battleArea.some(
      // Command jogada como Pilot (`asPilot`) também é "(X) Pilot in play" (E10)
      (c) => isActingAsPilot(c) && (effectivePilotDef(c).traits ?? []).includes(trait),
    );
  }
  // GD02-054 Gundam Barbatos 1st Form / GD02-095 Lafter Frankland (Pilot, "this Unit" =
  // Unit pareada) — 【Attack】"If this Unit is damaged, ...".
  if (predicate === "selfIsDamaged") {
    const selfUnit = resolveSelfUnit(ctx.state, ctx.sourceInstanceId);
    return !!selfUnit && selfUnit.damage > 0;
  }
  // GD02-081 Methuss / GD02-071 Gundam Mk-II (AEUG) — "If a friendly white Base is in play, ...".
  const controllerHasBaseColor = predicate.match(/^controllerHasBaseColor:(.+)$/);
  if (controllerHasBaseColor) {
    const color = controllerHasBaseColor[1];
    return ctx.state.players[ctx.controller].baseSection.some((b) => b.def.color === color);
  }
  // GD02-061 Hyakuri — "【When Paired･Purple Pilot】..." — cor do PILOT recém-pareado com a fonte (Unit).
  const pairedPilotColorIs = predicate.match(/^pairedPilotColorIs:(.+)$/);
  if (pairedPilotColorIs) {
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    if (!source.pairedPilotId) return false;
    return findCard(ctx.state, source.pairedPilotId).def.color === pairedPilotColorIs[1];
  }
  // GD02-091 Haman Karn (Pilot) — "If this Unit is red, ..." — cor IMPRESSA da Unit
  // pareada (não da própria carta do Pilot — mesma convenção de resolveSelfUnit).
  const selfColorIs = predicate.match(/^selfColorIs:(.+)$/);
  if (selfColorIs) {
    const selfUnit = resolveSelfUnit(ctx.state, ctx.sourceInstanceId);
    return !!selfUnit && selfUnit.def.color === selfColorIs[1];
  }
  // GD02-095 Lafter Frankland (Pilot) — "If this Unit is ... Lv.5 or lower, ...".
  const selfLevelAtMost = predicate.match(/^selfLevelAtMost:(\d+)$/);
  if (selfLevelAtMost) {
    const selfUnit = resolveSelfUnit(ctx.state, ctx.sourceInstanceId);
    return !!selfUnit && (selfUnit.def.level ?? 0) <= Number(selfLevelAtMost[1]);
  }
  // GD02-037 Gundam Virsago — "If there are 3 or less enemy Shields, ...".
  const enemyShieldCountAtMost = predicate.match(/^enemyShieldCountAtMost:(\d+)$/);
  if (enemyShieldCountAtMost) {
    return ctx.state.players[otherPlayer(ctx.controller)].shields.length <= Number(enemyShieldCountAtMost[1]);
  }
  // GD02-056 Gundam X — "【During Pair･(Vulture) Pilot】【Destroyed】..." — trait do Pilot que
  // estava pareado no momento da destruição (alvo implícito "formerPairedPilot", injetado pelo
  // dispatcher em ctx.targets ANTES do DESTROY_CARD, mesmo mecanismo de GD01-005 Unicorn Gundam).
  const formerPairedPilotHasTrait = predicate.match(/^formerPairedPilotHasTrait:(.+)$/);
  if (formerPairedPilotHasTrait) {
    const pilotId = ctx.targets.formerPairedPilot?.[0];
    if (!pilotId) return false;
    return (findCard(ctx.state, pilotId).def.traits ?? []).includes(formerPairedPilotHasTrait[1]);
  }
  // GD02-021 Gundam AGE-1 Normal — "if you are Lv.7 or higher, ...". Nível do JOGADOR (não de
  // uma carta) = quantidade de Resources em campo, mesma fórmula de `canPayLevel` (deploy.ts).
  const controllerLevelAtLeast = predicate.match(/^controllerLevelAtLeast:(\d+)$/);
  if (controllerLevelAtLeast) {
    return ctx.state.players[ctx.controller].resourceArea.length >= Number(controllerLevelAtLeast[1]);
  }
  // GD02-003 Gundam Mk-II (Titans) — "【During Pair･Lv.3 or Lower Pilot】【Destroyed】You may
  // discard 1 Unit card. If you do, return the card paired with this Unit to your hand." Precisa
  // combinar 2 gates numa só predicate pra `condition2` (nível do Pilot que estava pareado +
  // a escolha nomeada "discard" não vazia): `buildQueueEntry` (abilityDispatch.ts) monta a
  // escolha de `discardNamed` sem olhar pro `condition` que a envolve (mesmo "prompt fantasma"
  // aceito em GD02-056), então usar só `chosenNonEmpty:discard` sozinho devolveria o Piloto à
  // mão mesmo com um Pilot Lv.4+ pareado (que nem deveria oferecer esta habilidade).
  const formerPairedPilotLevelAtMostAndChosenNonEmpty = predicate.match(
    /^formerPairedPilotLevelAtMostAndChosenNonEmpty:(\d+):(.+)$/,
  );
  if (formerPairedPilotLevelAtMostAndChosenNonEmpty) {
    const [, maxLevel, key] = formerPairedPilotLevelAtMostAndChosenNonEmpty;
    const pilotId = ctx.targets.formerPairedPilot?.[0];
    if (!pilotId) return false;
    const levelOk = (findCard(ctx.state, pilotId).def.level ?? 0) <= Number(maxLevel);
    const chosenOk = (ctx.targets[key] ?? []).length > 0;
    return levelOk && chosenOk;
  }
  // GD02-098 Quattro Bajeena (Pilot) — "If this is an (AEUG) Unit, ..." — trait IMPRESSO da Unit
  // pareada (mesma convenção de selfColorIs/selfLevelAtMost).
  const selfHasTrait = predicate.match(/^selfHasTrait:(.+)$/);
  if (selfHasTrait) {
    const selfUnit = resolveSelfUnit(ctx.state, ctx.sourceInstanceId);
    return !!selfUnit && (selfUnit.def.traits ?? []).includes(selfHasTrait[1]);
  }
  // GD02-111 Decisive Last Resort — "Choose 6 purple Unit cards from your trash. Exile them...".
  // Checado ANTES da própria primitiva `firstNInTrash` rodar (mesma ordem cost->condition->actions
  // de controllerTrashCountAtLeast acima) — "if you do" == havia 6+ cartas elegíveis na lixeira.
  const controllerTrashUnitColorCountAtLeast = predicate.match(/^controllerTrashUnitColorCountAtLeast:(.+):(\d+)$/);
  if (controllerTrashUnitColorCountAtLeast) {
    const color = controllerTrashUnitColorCountAtLeast[1];
    const min = Number(controllerTrashUnitColorCountAtLeast[2]);
    const count = ctx.state.players[ctx.controller].trash.filter(
      (c) => c.def.cardType === "UNIT" && c.def.color === color,
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

/**
 * Resolve "this Unit" quando a fonte pode ser a própria Unit OU um Pilot
 * pareado com ela (texto autorado no Pilot sempre fala da Unit pareada, não
 * do Pilot — mesma convenção de `level<=self`/`sourcePairedUnitIsLinkUnit`).
 * `undefined` se a fonte é Pilot sem Unit pareada agora.
 */
function resolveSelfUnit(state: GameState, sourceInstanceId: string): CardInstance | undefined {
  const source = findCard(state, sourceInstanceId);
  if (source.def.cardType === "UNIT") return source;
  return source.pairedUnitId ? findCard(state, source.pairedUnitId) : undefined;
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

  // GD01-122 Covert Operative — "Choose 1 enemy Unit with 2 or less HP... If you have a
  // Link Unit in play, choose 1 enemy Unit with 4 or less HP instead." Lote 5 (docs/debates
  // 2026-09-13): o LIMITE do filtro muda por condição de board — precisa de sourceInstanceId
  // (dono do efeito) pra checar se O CONTROLLER tem Link Unit em campo agora.
  const hpAtMostConditionalLink = filter.match(/^hp<=conditionalLinkUnit:(\d+):(\d+)$/);
  if (hpAtMostConditionalLink) {
    if (!ctx.sourceInstanceId) return false;
    const source = findCard(ctx.state, ctx.sourceInstanceId);
    const controllerHasLinkUnit = ctx.state.players[source.owner].battleArea.some(
      (u) => u.def.cardType === "UNIT" && isPairedLinkUnit(ctx.state, u),
    );
    const threshold = Number(hpAtMostConditionalLink[controllerHasLinkUnit ? 2 : 1]);
    return remainingHp(candidate, ctx.state) <= threshold;
  }

  const levelAtMost = filter.match(/^level<=(\d+)$/);
  if (levelAtMost) return (candidate.def.level ?? 0) <= Number(levelAtMost[1]);

  // ST04-006 Aegis Gundam — "enemy Unit that is Lv.5 or higher".
  const levelAtLeast = filter.match(/^level>=(\d+)$/);
  if (levelAtLeast) return (candidate.def.level ?? 0) >= Number(levelAtLeast[1]);

  // ST03-015 Rewloola — "enemy Unit with 5 or less AP".
  const apAtMost = filter.match(/^ap<=(\d+)$/);
  if (apAtMost) return effectiveAp(candidate, ctx.state) <= Number(apAtMost[1]);

  // ST04-015 Archangel — "friendly Unit with <Blocker>". `hasKeyword` (não só
  // `effectKeywords ?? []`/`keywordGrants`) também enxerga concessão via
  // `staticAbilities` (ex. Sinanju 【During Pair】<High-Maneuver>) — achado ao
  // fechar deferred.ts ST03-001/GD01-001 (docs/47).
  const hasKw = filter.match(/^hasKeyword:(.+)$/);
  if (hasKw) return hasKeyword(candidate, hasKw[1], ctx.state);

  // GD01-049 Blitz Gundam — "1 of your (ZAFT) Units with 5 or more AP" (trait, sempre em composição com outro filtro via ";").
  const traitMatch = filter.match(/^trait:(.+)$/);
  if (traitMatch) return (candidate.def.traits ?? []).includes(traitMatch[1]);

  // GD01-049 Blitz Gundam — companion do filtro de trait acima.
  const apAtLeast = filter.match(/^ap>=(\d+)$/);
  if (apAtLeast) return effectiveAp(candidate, ctx.state) >= Number(apAtLeast[1]);

  if (filter === "rested") return candidate.rested;

  // GD01-103/112 — "1/2 active friendly/enemy Unit(s)" (o oposto de "rested").
  if (filter === "active") return !candidate.rested;

  // ST05-001 Gundam Barbatos 4th Form — 【Deploy】"Choose 1 of your OTHER Units."
  // Exclui a própria fonte do pool de `friendlyUnit` (que por padrão a inclui).
  if (filter === "notSelf") return ctx.sourceInstanceId ? candidate.instanceId !== ctx.sourceInstanceId : true;
  // GD02-089 Lalah Sune (Pilot) — "Choose 1 of your OTHER (Zeon) Link Units": exclui a Unit da fonte
  // (a pareada, quando a fonte é Pilot) — `notSelf` compararia com o próprio Pilot.
  if (filter === "notSelfUnit") {
    if (!ctx.sourceInstanceId) return true;
    const selfUnit = resolveSelfUnit(ctx.state, ctx.sourceInstanceId);
    return !selfUnit || candidate.instanceId !== selfUnit.instanceId;
  }

  // GD01-066 Justice Gundam — "Choose 1 of your (Triple Ship Alliance) Unit TOKENS."
  // Sempre em composição com `trait:X` via ";" (o texto nunca restringe só por token).
  if (filter === "isToken") return candidate.def.isToken === true;

  // ST05-015 Isaribi — 【Activate･Main】"Choose 1 of your damaged Units."
  if (filter === "damaged") return candidate.damage > 0;

  // GD01-101 Deep Devotion — "1 friendly Link Unit".
  if (filter === "linkUnit") return isPairedLinkUnit(ctx.state, candidate);

  // GD01-093 Marida Cruz — "enemy Unit whose Lv. is equal to or lower than THIS Unit"
  // (relativo à própria fonte, não um número literal — precisa de `ctx.sourceInstanceId`).
  // A ability é autorada no PILOT ("During Link"), mas "this Unit" no texto é a Unit
  // PAREADA (quem ataca de verdade) — se a fonte já é Unit, usa ela mesma.
  if (filter === "level<=self") {
    if (!ctx.sourceInstanceId) return false;
    const selfUnit = resolveSelfUnit(ctx.state, ctx.sourceInstanceId);
    if (!selfUnit) return false;
    return (candidate.def.level ?? 0) <= (selfUnit.def.level ?? 0);
  }

  // GD01-069 Strike Rouge — "1 of your rested white Units with <Blocker>" (cor impressa da carta, não trait).
  const colorMatch = filter.match(/^color:(.+)$/);
  if (colorMatch) return candidate.def.color === colorMatch[1];

  // ST06-007 Ortega's Rick Dom — "Choose 1 of your other (Clan) Units" (exclui a própria fonte).
  if (filter === "isNotSelf") {
    return ctx.sourceInstanceId !== undefined && candidate.instanceId !== ctx.sourceInstanceId;
  }

  // ST08-001 Xi Gundam — "Choose 1 enemy Unit with the highest Lv."
  if (filter === "highestLevel") {
    const enemyUnits = ctx.state.players[candidate.owner].battleArea.filter((u) => u.def.cardType === "UNIT");
    const maxLevel = Math.max(...enemyUnits.map((u) => u.def.level ?? 0), 0);
    return (candidate.def.level ?? 0) === maxLevel;
  }

  // GD02-118 Heart Set on Revenge — "enemy Unit ... battling a friendly Unit with <Blocker>".
  // O candidato precisa ser um dos 2 lados do combate ATUAL, com o outro lado sendo uma Unit
  // AMIGA (do controller do efeito) com a keyword dada (mesmo padrão de excludeInstanceId de
  // `battlingEnemyLevelAtMost`, só que aqui o candidato JÁ É "quem eu sou" — a fonte do olhar).
  const battlingFriendlyHasKeyword = filter.match(/^battlingFriendlyHasKeyword:(.+)$/);
  if (battlingFriendlyHasKeyword) {
    if (!ctx.sourceInstanceId) return false;
    const combat = ctx.state.combat;
    if (!combat) return false;
    let opposingId: string | undefined;
    if (combat.attackerId === candidate.instanceId && combat.currentTarget !== "player") opposingId = combat.currentTarget.unitId;
    else if (combat.currentTarget !== "player" && combat.currentTarget.unitId === candidate.instanceId) opposingId = combat.attackerId;
    if (!opposingId) return false;
    const controller = findCard(ctx.state, ctx.sourceInstanceId).owner;
    const opposing = findCard(ctx.state, opposingId);
    return opposing.owner === controller && hasKeyword(opposing, battlingFriendlyHasKeyword[1], ctx.state);
  }

  return false;
};
