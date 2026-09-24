import type { AttackTarget, CardDef, CardInstance, CombatTrigger, GameEvent, GameState, PendingCombatTriggerChoice, PlayerId } from "./types";
import {
  effectiveAp,
  effectiveHp,
  effectivePilotDef,
  hasKeyword,
  keywordValue,
  otherPlayer,
  pairedPilotFollowEvents,
  satisfiesLinkCondition,
} from "./types";
import { applyEvent, applyEvents, findCard } from "./events";
import { matchesCardDefFilter } from "./effectSpec";

/**
 * Sequência de combate (Comprehensive Rules seção 8, ver docs/18 "Estrutura
 * de turno" → "Sequência de combate"). Cada Attack Step é conduzido passo a
 * passo, expondo uma função por decisão, pra dar pra dirigir tanto de teste
 * quanto de UI (nenhuma das duas decide "sozinha" o que acontece).
 */

function requireCombat(state: GameState) {
  if (!state.combat) throw new Error("Nenhum combate em andamento");
  return state.combat;
}

// ---------------------------------------------------------------------------
// 1. Attack Step
// ---------------------------------------------------------------------------

export function declareAttack(state: GameState, attackerId: string, target: AttackTarget): GameState {
  const attacker = findCard(state, attackerId);
  if (attacker.zone !== "battleArea") throw new Error("Só Units na Battle Area podem atacar");
  if (attacker.owner !== state.activePlayer) throw new Error("Só o jogador ativo pode declarar ataque");
  if (attacker.rested) throw new Error("Unit rested não pode atacar");
  if (attacker.cannotAttackUntilTurn === state.turnNumber) {
    // ST04-015 Archangel 【Activate･Main】 — "It can't attack during this turn."
    throw new Error(`${attacker.def.code}: esta Unit não pode atacar neste turno`);
  }
  if (state.phase !== "main") throw new Error("Ataque só pode ser declarado na Main Phase");
  if (state.combat) throw new Error("Já existe um combate em andamento");
  if (attacker.enteredZoneOnTurn === state.turnNumber) {
    // Comprehensive Rules 3-2-4: Unit recém-deployada não pode atacar no turno em
    // que entrou em campo — exceto se virou Link Unit ao ser pareada (3-2-6-3), ou
    // se um efeito concedeu a exceção explicitamente (GD01-066 Justice Gundam —
    // "Choose 1 of your Unit tokens. It may attack on the turn it is deployed.",
    // keyword sintética via `grantKeyword`, docs/47 Fase 3).
    const pilot = attacker.pairedPilotId ? findCard(state, attacker.pairedPilotId) : undefined;
    const isLinkUnit = pilot ? satisfiesLinkCondition(effectivePilotDef(pilot), attacker.def) : false;
    const hasDeployTurnGrant = hasKeyword(attacker, "AttackOnDeployTurn", state);
    if (!isLinkUnit && !hasDeployTurnGrant) {
      throw new Error(
        "Unit recém-deployada não pode atacar no turno em que entrou em campo (Comprehensive Rules 3-2-4), exceto se for Link Unit (3-2-6-3) ou tiver a exceção concedida por efeito",
      );
    }
  }

  const defendingPlayer = otherPlayer(state.activePlayer);
  if (target === "player") {
    // ex.: ST01-009 Zowort — "This Unit can't choose the enemy player as its attack target." (docs/18, lacuna #6)
    // GD02-069 Zeta Gundam — mesma restrição, mas TEMPORÁRIA ("during this turn") — concedida via
    // grantKeyword sintético "CannotTargetPlayer" em vez de attackTargetRules (fixo na CardDef).
    if (attacker.def.attackTargetRules?.cannotTargetPlayer || hasKeyword(attacker, "CannotTargetPlayer", state)) {
      throw new Error(`${attacker.def.code}: esta Unit não pode escolher o jogador inimigo como alvo de ataque`);
    }
  }
  if (typeof target === "object") {
    const targetUnit = findCard(state, target.unitId);
    if (targetUnit.owner !== defendingPlayer || targetUnit.zone !== "battleArea") {
      throw new Error("Alvo precisa ser uma Unit inimiga na Battle Area");
    }
    if (targetUnit.rested) {
      // sempre legal
    } else {
      // relaxamento explícito: ex. ST02-001 Wing Gundam pode escolher Unit inimiga
      // ACTIVE (não só rested), desde que seja Lv. igual ou menor ao concedido
      // (docs/18, lacuna #6, direção oposta de Zowort acima). Além do campo
      // estático `attackTargetRules`, vale também a concessão temporária de
      // ST04-011 Athrun Zala 【When Linked】 (`attackTargetRelaxUntilTurn`, só no
      // turno em que foi concedida).
      const staticRelaxLevel = attacker.def.attackTargetRules?.mayTargetActiveEnemyUnit?.maxLevel ?? -1;
      // GD01-043/GD01-110 — a concessão temporária também pode vir por AP em
      // vez de nível ("... com 4 ou menos AP" em vez de "Lv.X ou menor");
      // `grantAttackTargetRelax` guarda qual dos dois critérios foi concedido.
      const granted =
        attacker.attackTargetRelaxUntilTurn?.turn === state.turnNumber ? attacker.attackTargetRelaxUntilTurn : undefined;
      const grantedRelaxLevel = granted?.maxLevel ?? -1;
      const relaxMaxLevel = Math.max(staticRelaxLevel, grantedRelaxLevel);
      const allowedByLevel = relaxMaxLevel >= 0 && (targetUnit.def.level ?? 0) <= relaxMaxLevel;
      const allowedByAp = granted?.maxAp !== undefined && effectiveAp(targetUnit, state) <= granted.maxAp;
      const allowed = allowedByLevel || allowedByAp;
      if (!allowed) {
        throw new Error("Só é possível declarar ataque contra Unit inimiga rested (exceto keyword que relaxe essa regra)");
      }
    }
  }

  const events: GameEvent[] = [
    { type: "REST_CARD", instanceId: attackerId },
    {
      type: "ATTACK_DECLARED",
      attackerId,
      attackingPlayer: state.activePlayer,
      defendingPlayer,
      target,
    },
  ];
  return applyEvents(state, events);
}

/**
 * Fecha o Attack Step e entra no Block Step. Ponto de extensão futuro pra
 * efeitos 【Attack】 bespoke (autoria carta a carta, fora de escopo da Fase 1
 * ainda) — hoje só troca a fase do combate.
 */
export function proceedToBlockStep(state: GameState): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "attack") throw new Error("Não é o Attack Step");
  return applyEvent(state, { type: "COMBAT_STEP_CHANGE", step: "block" });
}

// ---------------------------------------------------------------------------
// 2. Block Step
// ---------------------------------------------------------------------------

/** <High-Maneuver>: "opponent can't activate Blocker while this Unit attacks" */
export function canActivateBlocker(state: GameState): boolean {
  const combat = requireCombat(state);
  const attacker = findCard(state, combat.attackerId);
  return !hasKeyword(attacker, "High-Maneuver", state);
}

export function activateBlocker(state: GameState, blockerId: string): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "block") {
    throw new Error("Só é possível ativar <Blocker> durante o Block Step");
  }
  if (!canActivateBlocker(state)) {
    throw new Error("<High-Maneuver>: bloqueio não pode ser ativado contra esta Unit");
  }
  const blocker = findCard(state, blockerId);
  if (blocker.owner !== combat.defendingPlayer) throw new Error("Blocker precisa pertencer a quem está defendendo");
  if (blocker.zone !== "battleArea") throw new Error("Blocker precisa estar na Battle Area");
  if (blocker.rested) throw new Error("Blocker precisa estar active pra ser ativado");
  if (!hasKeyword(blocker, "Blocker", state)) throw new Error("Essa Unit não tem <Blocker>");

  const events: GameEvent[] = [
    { type: "REST_CARD", instanceId: blockerId },
    { type: "BLOCK_DECLARED", blockerId, newTarget: { unitId: blockerId } },
    { type: "COMBAT_STEP_CHANGE", step: "action" },
  ];
  return applyEvents(state, events);
}

/** Jogador em espera decide não bloquear — combate segue pro Action Step sem mudar o alvo. */
export function skipBlock(state: GameState): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "block") throw new Error("Só é possível pular o Block Step durante o Block Step");
  return applyEvent(state, { type: "COMBAT_STEP_CHANGE", step: "action" });
}

// ---------------------------------------------------------------------------
// 3. Action Step — jogadores alternam, começando pelo jogador em espera, até
// os dois passarem em sequência (Comprehensive Rules — ver docs/18). A Fase
// 1 ainda não tem cartas 【Action】/【Activate·Action】 implementadas via DSL
// (isso é trabalho de conteúdo por carta, não do motor em si), então por
// enquanto a única ação disponível aqui é passar — mas o desenho já respeita
// o formato de prioridade alternada pra não precisar redesenhar na Fase 3.
// ---------------------------------------------------------------------------

export function passAction(state: GameState, player: PlayerId): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "action") throw new Error("Não é o Action Step");
  if (combat.actionPriority !== player) throw new Error("Não é a prioridade desse jogador");

  let next = applyEvent(state, { type: "ACTION_PASS", player });
  const bothPassed = next.combat!.actionPasses.A && next.combat!.actionPasses.B;
  if (bothPassed) {
    next = applyEvent(next, { type: "COMBAT_STEP_CHANGE", step: "damage" });
  }
  return next;
}

// ---------------------------------------------------------------------------
// 4. Damage Step
// ---------------------------------------------------------------------------

function shieldDamageEvents(defendingPlayer: PlayerId, count: number, state: GameState): GameEvent[] {
  const shields = state.players[defendingPlayer].shields;
  if (shields.length === 0) {
    // Comprehensive Rules 1-2-2-1: recebeu dano de batalha sem shield = derrota
    return [{ type: "GAME_OVER", winner: otherPlayer(defendingPlayer), reason: "noShieldsBattleDamage" }];
  }
  return [{ type: "DAMAGE_SHIELD", player: defendingPlayer, count }];
}

/**
 * <Breach N> (glossário docs/17): N de dano na PRIMEIRA carta da área de escudo do
 * oponente — a Base, se houver (N de dano normal, destrói se chegar ao HP); senão o
 * escudo do topo (Shield tem "1 HP": cai 1, nunca N). Sem Base nem escudo o efeito
 * não ativa — NÃO é "dano de batalha no jogador sem escudo" (isso é derrota só pro
 * dano de batalha comum, `shieldDamageEvents`). `destroyedShieldAreaCard` alimenta
 * gatilhos "destrói uma carta da área de escudo com dano" (GD02-001 Psycho Gundam).
 */
function breachEvents(
  attacker: CardInstance,
  defendingPlayer: PlayerId,
  state: GameState,
): { events: GameEvent[]; destroyedShieldAreaCard: boolean } {
  const breachValue = keywordValue(attacker, "Breach", state);
  if (breachValue === null || breachValue <= 0) return { events: [], destroyedShieldAreaCard: false };
  const base = state.players[defendingPlayer].baseSection[0];
  if (base) {
    const events: GameEvent[] = [{ type: "DAMAGE_BASE", instanceId: base.instanceId, amount: breachValue }];
    const destroyed = base.damage + breachValue >= effectiveHp(base, state);
    if (destroyed) events.push({ type: "DESTROY_CARD", instanceId: base.instanceId });
    return { events, destroyedShieldAreaCard: destroyed };
  }
  if (state.players[defendingPlayer].shields.length === 0) return { events: [], destroyedShieldAreaCard: false };
  return { events: [{ type: "DAMAGE_SHIELD", player: defendingPlayer, count: 1 }], destroyedShieldAreaCard: true };
}

/**
 * GD01-091 Chang Wufei (Pilot) — autorado num PILOT, mas "this Unit" no texto
 * é a Unit PAREADA (mesma convenção de GD01-087/089/092/096, Lote 3) — por
 * isso `CardDef.innateDamageProtection` é procurado tanto na própria Unit
 * quanto no Pilot pareado com ela, nunca só num dos dois.
 */
function findInnateDamageProtection(unit: CardInstance, state: GameState): CardDef["innateDamageProtection"] {
  if (unit.def.innateDamageProtection) return unit.def.innateDamageProtection;
  if (unit.pairedPilotId) return findCard(state, unit.pairedPilotId).def.innateDamageProtection;
  return undefined;
}

/**
 * Habilidades condicionadas a 【During Pair】/【During Link】 que reagem a
 * "esta Unit destrói um inimigo em batalha" (docs/18, lacuna #2 estendida) —
 * ex. ST02-003 Gundam Heavyarms (During Pair: dano em grupo) e ST02-011
 * Zechs Merquise (During Link: draw). Só dispara pro lado que causou a
 * destruição (o atacante — CR: "during your turn" nunca é satisfeito pelo
 * defensor, já que quem defende nunca é o jogador ativo). Procura o gatilho
 * tanto na própria Unit (`attacker.def`) quanto no Pilot pareado com ela
 * (`CombatTrigger` pode viver nos dois lados — ver `CardDef.combatTriggers`).
 */
interface CombatTriggerResult {
  events: GameEvent[];
  /** docs/47 Fase 6 — gatilhos que precisam de escolha real do jogador (não resolvidos aqui, ver `resolveDamageStep`). */
  pendingChoices: PendingCombatTriggerChoice[];
}

function combatTriggerEvents(attacker: CardInstance, state: GameState, on: CombatTrigger["on"], destroyedEnemy?: CardInstance): CombatTriggerResult {
  if (attacker.owner !== state.activePlayer) return { events: [], pendingChoices: [] }; // "during your turn" — nunca satisfeito pelo defensor
  const pilot = attacker.pairedPilotId ? findCard(state, attacker.pairedPilotId) : undefined;
  const sources = [attacker.def, ...(pilot ? [pilot.def] : [])];

  const events: GameEvent[] = [];
  const pendingChoices: PendingCombatTriggerChoice[] = [];
  for (const def of sources) {
    for (const trigger of def.combatTriggers ?? []) {
      if (trigger.on !== on) continue;
      const conditionMet =
        trigger.condition === "always"
          ? true
          : trigger.condition === "duringPair"
            ? !!pilot
            : !!pilot && satisfiesLinkCondition(effectivePilotDef(pilot), attacker.def);
      if (!conditionMet) continue;
      // GD01-094 Yzak Jule — "When an enemy Link Unit is destroyed ...". Checa ANTES
      // do DESTROY_CARD limpar o pareamento (destroyedEnemy ainda tem pairedPilotId).
      if (trigger.requiresLinkUnitEnemy) {
        const enemyPilot = destroyedEnemy?.pairedPilotId ? findCard(state, destroyedEnemy.pairedPilotId) : undefined;
        const enemyIsLinkUnit = !!destroyedEnemy && !!enemyPilot && satisfiesLinkCondition(effectivePilotDef(enemyPilot), destroyedEnemy.def);
        if (!enemyIsLinkUnit) continue;
      }
      // GD02-093 Olba Frost — "destroys an enemy Unit paired with a (Newtype) Pilot ...".
      if (trigger.requiresEnemyPairedPilotTrait) {
        const enemyPilot = destroyedEnemy?.pairedPilotId ? findCard(state, destroyedEnemy.pairedPilotId) : undefined;
        if (!enemyPilot || !(enemyPilot.def.traits ?? []).includes(trigger.requiresEnemyPairedPilotTrait)) continue;
      }
      // "【Once per Turn】" — mesmo mecanismo de <Support>/<Repair>, chave sintética por `on`.
      const usageMarker = `combatTrigger:${trigger.on}`;
      if (trigger.oncePerTurn) {
        if (attacker.usedKeywordsThisTurn.includes(usageMarker)) continue;
        events.push({ type: "MARK_KEYWORD_USED", instanceId: attacker.instanceId, keyword: usageMarker });
      }

      const action = trigger.action;
      switch (action.kind) {
        case "draw": {
          const deck = state.players[attacker.owner].deck;
          for (let i = 0; i < action.amount && i < deck.length; i++) {
            events.push({ type: "DRAW_CARD", player: attacker.owner, from: "deck", instanceId: deck[i]?.instanceId ?? null });
          }
          break;
        }
        case "damageAllEnemyUnits": {
          const opponent = state.players[otherPlayer(attacker.owner)];
          for (const enemy of opponent.battleArea) {
            if (enemy.def.cardType !== "UNIT") continue;
            if (action.maxLevel !== undefined && (enemy.def.level ?? 0) > action.maxLevel) continue;
            events.push({ type: "DAMAGE_UNIT", instanceId: enemy.instanceId, amount: action.amount });
            if (enemy.damage + action.amount >= effectiveHp(enemy, state)) {
              events.push({ type: "DESTROY_CARD", instanceId: enemy.instanceId });
              events.push(...pairedPilotFollowEvents(enemy));
            }
          }
          break;
        }
        case "damageChosenEnemyUnit": {
          // docs/47 Fase 6 — escolha REAL do jogador (antes: auto-mira a 1ª Unit
          // inimiga legal, docs/43 §4). Sem alvo legal, o efeito não ativa (igual
          // a antes) — não gera pausa nenhuma.
          const opponent = state.players[otherPlayer(attacker.owner)];
          const legalCandidates = opponent.battleArea.filter((c) => c.def.cardType === "UNIT").map((c) => c.instanceId);
          if (legalCandidates.length > 0) {
            pendingChoices.push({ sourceInstanceId: attacker.instanceId, action, legalCandidates, label: def.nameEn });
          }
          break;
        }
        case "retrieveFromTrash": {
          // docs/47 Fase 6 — ST05-011 Akihiro Altland.
          const legalCandidates = state.players[attacker.owner].trash
            .filter((c) => matchesCardDefFilter(c.def, action.filter))
            .map((c) => c.instanceId);
          if (legalCandidates.length > 0) {
            pendingChoices.push({ sourceInstanceId: attacker.instanceId, action, legalCandidates, label: def.nameEn });
          }
          break;
        }
      }
    }
  }
  return { events, pendingChoices };
}

/**
 * GD02-001 Psycho Gundam / GD02-002 Gundam Epyon — "When one of your Units destroys an
 * enemy Unit/shield card with battle damage, ..." — `actor` é quem destruiu (pode ser
 * QUALQUER Unit amiga, não só o listener), escaneia a Battle Area do controller ATRÁS
 * de `allyCombatTriggers` em cada carta (+ Pilot pareado) e aplica a ação em SI MESMA
 * (nunca em `actor`). Sem escolha de jogador — vocabulário de `action` é só heal/setActive.
 */
function allyCombatTriggerEvents(actor: CardInstance, state: GameState, on: CombatTrigger["on"]): GameEvent[] {
  if (actor.owner !== state.activePlayer) return []; // "during your turn"
  const events: GameEvent[] = [];
  for (const listener of state.players[actor.owner].battleArea) {
    const pilot = listener.pairedPilotId ? findCard(state, listener.pairedPilotId) : undefined;
    const sources = [listener.def, ...(pilot ? [pilot.def] : [])];
    for (const def of sources) {
      for (const trigger of def.allyCombatTriggers ?? []) {
        if (trigger.on !== on) continue;
        if (trigger.requiresActorTrait && !(actor.def.traits ?? []).includes(trigger.requiresActorTrait)) continue;
        if (trigger.requiresPairedPilotTrait && !(pilot && (pilot.def.traits ?? []).includes(trigger.requiresPairedPilotTrait))) continue;
        const conditionMet =
          trigger.condition === "always"
            ? true
            : trigger.condition === "duringPair"
              ? !!pilot
              : !!pilot && satisfiesLinkCondition(effectivePilotDef(pilot), listener.def);
        if (!conditionMet) continue;
        const usageMarker = `allyCombatTrigger:${trigger.on}`;
        if (trigger.oncePerTurn) {
          if (listener.usedKeywordsThisTurn.includes(usageMarker)) continue;
          events.push({ type: "MARK_KEYWORD_USED", instanceId: listener.instanceId, keyword: usageMarker });
        }
        if (trigger.action.kind === "heal") {
          events.push({ type: "HEAL_UNIT", instanceId: listener.instanceId, amount: trigger.action.amount });
        } else {
          events.push({ type: "SET_ACTIVE", instanceId: listener.instanceId });
        }
      }
    }
  }
  return events;
}

/** <Breach> + o gatilho de aliados "destrói carta da área de escudo com dano" (GD02-001) quando o Breach destrói uma. */
function breachWithTriggers(attacker: CardInstance, defendingPlayer: PlayerId, state: GameState): GameEvent[] {
  const breach = breachEvents(attacker, defendingPlayer, state);
  if (!breach.destroyedShieldAreaCard) return breach.events;
  return [...breach.events, ...allyCombatTriggerEvents(attacker, state, "destroyEnemyShieldInBattle")];
}

export function resolveDamageStep(state: GameState): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "damage") throw new Error("Não é o Damage Step");

  const attacker = findCard(state, combat.attackerId);
  // Sprint 2 Lote 11 (GD02-011 Moebius "【Activate･Action】Destroy this Unit: ..." —
  // ativável no PRÓPRIO Action Step do ataque) — se o atacante foi removido do campo
  // antes do Damage Step (autodestruição via efeito, não só combate), a batalha não
  // causa dano NENHUM: não existe "atacante fantasma" batendo com o AP/HP congelados
  // de quando ainda estava em campo (`effectiveAp`/`findCard` não olham zona). Sem
  // este guard, mesmo um atacante com AP efetivo 0 ainda estourava 1 Shield "de
  // graça" — a contagem de Shield quebrado por ataque desbloqueado é FIXA (1, ou 2 com
  // <Suppression>), nunca proporcional ao AP. Mesma regra pra Base: sem atacante, sem
  // dano — a batalha simplesmente não aconteceu.
  if (attacker.zone !== "battleArea") return state;
  const attackerHasFirstStrike = hasKeyword(attacker, "First Strike", state);
  const events: GameEvent[] = [];
  // docs/47 Fase 6 — acumula gatilhos de combate que precisam de escolha real
  // do jogador (`damageChosenEnemyUnit`/`retrieveFromTrash`); resolvidos DEPOIS
  // de Burst/Destroyed, não aqui (ver `combat.pendingTriggerChoices` no retorno).
  const pendingChoices: PendingCombatTriggerChoice[] = [];
  const pushTrigger = (result: CombatTriggerResult) => {
    events.push(...result.events);
    pendingChoices.push(...result.pendingChoices);
  };

  if (combat.currentTarget === "player") {
    const defendingPlayer = combat.defendingPlayer;
    const base = state.players[defendingPlayer].baseSection[0];
    if (base) {
      events.push({ type: "DAMAGE_BASE", instanceId: base.instanceId, amount: effectiveAp(attacker, state) });
      const projectedDamage = base.damage + effectiveAp(attacker, state);
      if (projectedDamage >= effectiveHp(base, state)) {
        events.push({ type: "DESTROY_CARD", instanceId: base.instanceId });
        // A Base fica na área de escudo: destruí-la com dano de batalha conta como
        // "destroys an enemy shield area card" (ST03-001 Sinanju, GD02-001 Psycho Gundam).
        pushTrigger(combatTriggerEvents(attacker, state, "destroyEnemyShieldInBattle"));
        events.push(...allyCombatTriggerEvents(attacker, state, "destroyEnemyShieldInBattle"));
      }
    } else {
      const suppression = hasKeyword(attacker, "Suppression", state);
      // ST02-013 Peaceful Timbre — "During this battle, your shield area cards can't
      // receive damage from enemy Units that are Lv.4 or lower" (docs/18, lacuna #7).
      const protection = combat.shieldProtection;
      const attackerLevel = attacker.def.level ?? 0;
      const shieldsProtected = !!protection && attackerLevel <= protection.maxAttackerLevel;
      if (!shieldsProtected) {
        const hadShields = state.players[defendingPlayer].shields.length > 0;
        events.push(...shieldDamageEvents(defendingPlayer, suppression ? 2 : 1, state));
        if (hadShields) {
          // ST03-001 Sinanju — "when this Unit destroys an enemy shield area card
          // with battle damage, choose 1 enemy Unit. Deal 2 damage to it."
          pushTrigger(combatTriggerEvents(attacker, state, "destroyEnemyShieldInBattle"));
          // GD02-001 Psycho Gundam — "when one of your (Titans) Units destroys an enemy
          // shield area card with damage, this Unit recovers 2 HP" (QUALQUER Unit amiga).
          events.push(...allyCombatTriggerEvents(attacker, state, "destroyEnemyShieldInBattle"));
        }
      }
    }
  } else {
    const defender = findCard(state, combat.currentTarget.unitId);
    const defenderHasFirstStrike = hasKeyword(defender, "First Strike", state);
    const onlyAttackerFirstStrike = attackerHasFirstStrike && !defenderHasFirstStrike;
    const onlyDefenderFirstStrike = defenderHasFirstStrike && !attackerHasFirstStrike;

    const attackerAp = effectiveAp(attacker, state);
    const defenderAp = effectiveAp(defender, state);
    // ST03-014 The Blue Giant — a Unit protegida não recebe dano de batalha de
    // atacante com AP efetivo <= maxAttackerAp (o atacante ainda recebe o dele).
    const unitProt = combat.unitDamageProtection;
    const grantedProtects =
      !!unitProt &&
      unitProt.instanceId === defender.instanceId &&
      // GD02-105 Valedictorian — "can't receive battle damage from enemy Units during this
      // battle" (sem teto de AP/Level, protege de QUALQUER atacante).
      (unitProt.unconditional ||
        (unitProt.maxAttackerAp !== undefined && attackerAp <= unitProt.maxAttackerAp) ||
        (unitProt.maxAttackerLevel !== undefined && (attacker.def.level ?? 0) <= unitProt.maxAttackerLevel));
    // GD01-091 Chang Wufei (Lote 5) — proteção INATA e contínua (não instalada por
    // efeito pontual), reavaliada aqui mesmo: "During your turn, while this Unit has
    // <Breach>, it can't receive battle damage from enemy Units with 3 or less AP."
    const innate = findInnateDamageProtection(defender, state);
    const innateProtects =
      !!innate &&
      (!innate.duringYourTurnOnly || defender.owner === state.activePlayer) &&
      (!innate.requiresOwnKeyword || hasKeyword(defender, innate.requiresOwnKeyword, state)) &&
      ((innate.maxAttackerAp !== undefined && attackerAp <= innate.maxAttackerAp) ||
        (innate.maxAttackerLevel !== undefined && (attacker.def.level ?? 0) <= innate.maxAttackerLevel));
    // GD02-040 Gundam Ashtaron — "It can't receive battle damage from enemy Units with 2 or
    // less HP during this turn." (HP RESTANTE do atacante, mesma convenção do targetFilter
    // "hp<=N" — sobrevive a múltiplas batalhas no turno, ao contrário de unitDamageProtection.)
    const turnImmunity = defender.battleDamageImmunityUntilTurn;
    const turnImmunityProtects =
      !!turnImmunity && turnImmunity.turn === state.turnNumber && effectiveHp(attacker, state) - attacker.damage <= turnImmunity.maxAttackerHp;
    const defenderDamagePrevented = grantedProtects || innateProtects || turnImmunityProtects;
    // GD01-091 também protege O PRÓPRIO ATACANTE do contra-dano do defensor — "during your
    // turn" só é satisfeito enquanto ESTA Unit ataca (defensor nunca age no seu próprio
    // turno), então a aplicação real da carta é sempre este lado, não o do defensor.
    const attackerInnate = findInnateDamageProtection(attacker, state);
    const attackerDamagePrevented =
      !!attackerInnate &&
      (!attackerInnate.duringYourTurnOnly || attacker.owner === state.activePlayer) &&
      (!attackerInnate.requiresOwnKeyword || hasKeyword(attacker, attackerInnate.requiresOwnKeyword, state)) &&
      ((attackerInnate.maxAttackerAp !== undefined && defenderAp <= attackerInnate.maxAttackerAp) ||
        (attackerInnate.maxAttackerLevel !== undefined && (defender.def.level ?? 0) <= attackerInnate.maxAttackerLevel));
    const defenderWillDie = !defenderDamagePrevented && defender.damage + attackerAp >= effectiveHp(defender, state);
    const attackerWillDie = !attackerDamagePrevented && attacker.damage + defenderAp >= effectiveHp(attacker, state);

    if (onlyAttackerFirstStrike) {
      if (!defenderDamagePrevented) {
        events.push({ type: "DAMAGE_UNIT", instanceId: defender.instanceId, amount: attackerAp });
      }
      if (defenderWillDie) {
        events.push({ type: "DESTROY_CARD", instanceId: defender.instanceId });
        events.push(...pairedPilotFollowEvents(defender));
        events.push(...breachWithTriggers(attacker, combat.defendingPlayer, state));
        pushTrigger(combatTriggerEvents(attacker, state, "destroyEnemyInBattle", defender));
        events.push(...allyCombatTriggerEvents(attacker, state, "destroyEnemyInBattle"));
        // 13-1-5-2: destruiu com First Strike -> não recebe dano de volta
      } else {
        if (!attackerDamagePrevented) {
          events.push({ type: "DAMAGE_UNIT", instanceId: attacker.instanceId, amount: defenderAp });
        }
        if (attackerWillDie) {
          events.push({ type: "DESTROY_CARD", instanceId: attacker.instanceId });
          events.push(...pairedPilotFollowEvents(attacker));
        }
      }
    } else if (onlyDefenderFirstStrike) {
      if (!attackerDamagePrevented) {
        events.push({ type: "DAMAGE_UNIT", instanceId: attacker.instanceId, amount: defenderAp });
      }
      if (attackerWillDie) {
        events.push({ type: "DESTROY_CARD", instanceId: attacker.instanceId });
        events.push(...pairedPilotFollowEvents(attacker));
      } else {
        if (!defenderDamagePrevented) {
          events.push({ type: "DAMAGE_UNIT", instanceId: defender.instanceId, amount: attackerAp });
        }
        if (defenderWillDie) {
          events.push({ type: "DESTROY_CARD", instanceId: defender.instanceId });
          events.push(...pairedPilotFollowEvents(defender));
          events.push(...breachWithTriggers(attacker, combat.defendingPlayer, state));
          pushTrigger(combatTriggerEvents(attacker, state, "destroyEnemyInBattle", defender));
          events.push(...allyCombatTriggerEvents(attacker, state, "destroyEnemyInBattle"));
        }
      }
    } else {
      // simultâneo — ou nenhum tem First Strike, ou os dois têm (se cancelam, ver comentário abaixo)
      if (!defenderDamagePrevented) {
        events.push({ type: "DAMAGE_UNIT", instanceId: defender.instanceId, amount: attackerAp });
      }
      if (!attackerDamagePrevented) {
        events.push({ type: "DAMAGE_UNIT", instanceId: attacker.instanceId, amount: defenderAp });
      }
      if (defenderWillDie) {
        events.push({ type: "DESTROY_CARD", instanceId: defender.instanceId });
        events.push(...pairedPilotFollowEvents(defender));
        events.push(...breachWithTriggers(attacker, combat.defendingPlayer, state));
        pushTrigger(combatTriggerEvents(attacker, state, "destroyEnemyInBattle", defender));
        events.push(...allyCombatTriggerEvents(attacker, state, "destroyEnemyInBattle"));
      }
      if (attackerWillDie) {
        events.push({ type: "DESTROY_CARD", instanceId: attacker.instanceId });
        events.push(...pairedPilotFollowEvents(attacker));
      }
      // nota: quando ambos têm <First Strike>, 13-1-5-2 não cobre o caso — tratamos
      // como dano simultâneo (nenhum dos dois "primeiro" o suficiente pra anular o
      // outro). Reavaliar se algum ruling oficial específico aparecer.
    }
  }

  const next = applyEvents(state, events);
  // docs/47 Fase 6 — sobrevive em `combat` (limpo só em `COMBAT_ENDED`, mesmo
  // espírito de `shieldProtection`/`unitDamageProtection`) até `actions.ts`
  // converter em `PendingDecision.abilityResolution`, DEPOIS de Burst/Destroyed.
  if (pendingChoices.length > 0 && next.combat) {
    next.combat.pendingTriggerChoices = pendingChoices;
  }
  return next;
}

// ---------------------------------------------------------------------------
// 5. Battle End Step
// ---------------------------------------------------------------------------

export function resolveBattleEndStep(state: GameState): GameState {
  const combat = requireCombat(state);
  if (combat.step !== "damage") throw new Error("Precisa resolver o Damage Step antes");
  const next = applyEvent(state, { type: "COMBAT_STEP_CHANGE", step: "battleEnd" });

  // limpa modificadores "thisBattle" nos dois lados
  for (const playerId of ["A", "B"] as PlayerId[]) {
    const player = next.players[playerId];
    for (const zone of ["battleArea", "baseSection"] as const) {
      for (const card of player[zone]) {
        card.statModifiers = card.statModifiers.filter((m) => m.duration !== "thisBattle");
        card.keywordGrants = card.keywordGrants.filter((g) => g.duration !== "thisBattle");
      }
    }
  }

  return applyEvent(next, { type: "COMBAT_ENDED" });
}
