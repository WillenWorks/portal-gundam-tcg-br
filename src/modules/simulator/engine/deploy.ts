import type { CardDef, GameEvent, GameState, PlayerId } from "./types";
import { effectivePilotDef, satisfiesLinkCondition } from "./types";
import { applyEvents, findCard } from "./events";
import type { EffectSpec, PredicateResolver, TargetFilterResolver } from "./effectSpec";
import { specNeedsChoice } from "./effectSpec";
import { dispatchTrigger, findTriggerSpecs } from "./dispatcher";
import { deferOrDispatchAbilities, filterDispatchableSpecs } from "./abilityDispatch";
import { payResourceCostEvents } from "./costs";

/**
 * "Jogar carta da mão" (Main Phase) — a peça que faltava desde o passo 2
 * (`fullGame.test.ts` colocava Units direto na Battle Area por mutação de
 * teste, nunca via jogada real; ver comentário no topo daquele arquivo).
 * Fechada nesta wave (docs/18, "Motor de jogo real + gaps documentados",
 * decisão tomada com o Willen em 2026-08-28) porque sem isso uma "partida
 * real" não é de fato real — Units apareciam no campo sem pagar custo, sem
 * checar limite de zona, sem Pilot parear de verdade.
 *
 * Regras confirmadas contra a fonte oficial antes de implementar (Comprehensive
 * Rules v1.8.0, `gundam-gcg.com/en/pdf/comprehensiverules_en.pdf`, e o Play
 * Guide oficial, conferidos em 2026-08-28 — ver docs/18 "Onde mexer"):
 * - Custo: resta N Recursos active da Resource Area, N = `CardDef.cost`. Cor
 *   não importa, só quantidade.
 * - Nível: só pode jogar a carta se `resourceArea.length >= CardDef.level`
 *   (conta todos os recursos em campo, active ou rested — não é o custo,
 *   é um requisito prévio e separado).
 * - Base Section comporta só 1 Base por vez: deployar uma nova com uma já
 *   presente manda a antiga pro trash automaticamente — e essa troca
 *   explicitamente NÃO conta como "destruída" (não dispara gatilho
 *   Destroyed), por isso usamos MOVE_CARD direto, nunca DESTROY_CARD.
 * - Pilot nunca fica despareado em campo: jogar um Pilot da mão exige
 *   escolher, no mesmo ato, uma Unit amiga na Battle Area ainda sem Pilot.
 * - Battle Area comporta no máx. 6 *Units* — Pilots pareados também moram
 *   nessa zona (mesma convenção já usada nos testes existentes, ver
 *   `st01.test.ts`), então o limite conta só `cardType === "UNIT"`, nunca
 *   Pilots.
 * - Command puro não usa esta função — ver `playCommand()` abaixo (ele resolve
 *   o efeito e só depois vai pro trash, Comprehensive Rules 3-4-4). Já um card
 *   Command/Pilot (`CardDef.pilotMode`, ex. ST01-012) pode vir por aqui QUANDO
 *   o jogador escolhe o modo Pilot (pareado) — o modo Command dele continua
 *   indo por `playCommand()`. Quem decide o modo é a UI/o teste (ao passar ou
 *   não `pairWithUnitId`), o motor não infere.
 */

export interface DeployOptions {
  /** instanceIds de Recursos active a restar pra pagar o custo; se omitido, o motor escolhe os N primeiros active (ordem determinística do array) */
  resourceInstanceIds?: string[];
  /** obrigatório pra jogar um Pilot: Unit amiga na Battle Area ainda sem Pilot pareado */
  pairWithUnitId?: string;
  /** EffectSpecs conhecidos pra disparar Deploy/When Paired automaticamente após o deploy */
  specs?: EffectSpec[];
  /** grupos de alvo já resolvidos, repassados pro dispatcher (ver dispatcher.ts) */
  targets?: Record<string, string[]>;
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
}

export function canPayLevel(state: GameState, player: PlayerId, def: CardDef): boolean {
  return state.players[player].resourceArea.length >= (def.level ?? 0);
}

// Pagamento de custo de recurso (EX Resource sai do jogo, Recurso normal só resta) foi
// extraído pra costs.ts (payResourceCostEvents) — reaproveitado também pela primitiva de
// DSL `payResourceCost` (ver effectSpec.ts, docs/18 lacuna #4, ex. ST02-006 Tallgeese "④").
function payCostEvents(state: GameState, player: PlayerId, def: CardDef, resourceInstanceIds?: string[]): GameEvent[] {
  return payResourceCostEvents(state, player, def.cost ?? 0, resourceInstanceIds);
}

/** Joga uma carta Unit/Pilot/Base da mão (Comprehensive Rules 7 — Main Phase). */
export function deployCard(state: GameState, player: PlayerId, cardInstanceId: string, options: DeployOptions = {}): GameState {
  if (state.phase !== "main") throw new Error("Só é possível jogar carta da mão na Main Phase");
  if (state.activePlayer !== player) throw new Error("Só o jogador ativo pode jogar carta da mão");
  if (state.combat) throw new Error("Não é possível deployar Unit/Pilot/Base durante um combate em andamento");

  const card = findCard(state, cardInstanceId);
  if (card.owner !== player) throw new Error("Só é possível jogar carta da própria mão");
  if (card.zone !== "hand") throw new Error("Carta precisa estar na mão pra ser jogada");

  const def = card.def;
  // Command/Pilot (CardDef.pilotMode): `deployCard` só é o modo Pilot (pareado);
  // o modo Command continua indo por `playCommand`. Command puro nunca passa aqui.
  const playAsPilot = def.cardType === "PILOT" || (def.cardType === "COMMAND" && !!def.pilotMode);
  if (def.cardType === "COMMAND" && !def.pilotMode) throw new Error("Command não usa deployCard — ver playCommand()");
  if (def.cardType === "RESOURCE") throw new Error("Resource não é jogado da mão via deployCard — é comprado na Resource Phase");

  if (!canPayLevel(state, player, def)) {
    throw new Error(
      `Nível insuficiente pra jogar ${def.code}: precisa de ${def.level ?? 0} recursos em campo, tem ${state.players[player].resourceArea.length}`,
    );
  }

  const events: GameEvent[] = payCostEvents(state, player, def, options.resourceInstanceIds);

  if (def.cardType === "UNIT") {
    // V2 (docs/27): a jogada NUNCA é bloqueada pelo limite de 6 Units — a
    // regra oficial manda a 7ª entrar normalmente e o excesso ser resolvido
    // depois via rules management (`enforceZoneLimits`, actions.ts), igual à
    // Base logo abaixo. Bloquear aqui era o mesmo tipo de bug do Guntank/V0:
    // impedir a carta de ser jogada por causa de uma consequência que deveria
    // só ser tratada DEPOIS de ela entrar em campo.
    events.push({ type: "MOVE_CARD", instanceId: cardInstanceId, toZone: "battleArea" });
  } else if (def.cardType === "BASE") {
    const existing = state.players[player].baseSection[0];
    if (existing) {
      // regra confirmada: a Base excedente vai pro trash, mas NÃO é "destruída" —
      // por isso MOVE_CARD, nunca DESTROY_CARD (não dispara gatilho Destroyed).
      // Exceção: se a Base atual é um TOKEN (EX Base), ela é removida do jogo,
      // não vai pro trash (Comprehensive Rules — token que deixa o campo).
      events.push(
        existing.def.isToken
          ? { type: "REMOVE_CARD_FROM_GAME", instanceId: existing.instanceId }
          : { type: "MOVE_CARD", instanceId: existing.instanceId, toZone: "trash" },
      );
    }
    events.push({ type: "MOVE_CARD", instanceId: cardInstanceId, toZone: "baseSection" });
  } else if (playAsPilot) {
    if (!options.pairWithUnitId) throw new Error("Pilot precisa de uma Unit amiga escolhida pra parear ao ser jogado (Comprehensive Rules 3-3-1)");
    const unit = findCard(state, options.pairWithUnitId);
    if (unit.owner !== player || unit.zone !== "battleArea") {
      throw new Error("A Unit de pareamento precisa ser amiga e estar na Battle Area");
    }
    if (unit.def.cardType !== "UNIT") throw new Error("Só dá pra parear Pilot com Unit");
    if (unit.pairedPilotId) throw new Error("Essa Unit já tem um Pilot pareado");
    events.push({ type: "MOVE_CARD", instanceId: cardInstanceId, toZone: "battleArea" });
    events.push({
      type: "PAIR_CARDS",
      pilotId: cardInstanceId,
      unitId: options.pairWithUnitId,
      asPilotMode: def.cardType === "COMMAND",
    });
  }

  let next = applyEvents(state, events);

  const specs = options.specs ?? [];
  if (specs.length > 0) {
    // 【Deploy】 passa pelo MESMO mecanismo de pausa que 【When Paired】/【Attack】
    // (`deferOrDispatchAbilities`) — antes ia direto por `dispatchTrigger`, que
    // exige o alvo JÁ resolvido em `ctx.targets.target`; como nenhum caller
    // preenchia isso pra Deploy, qualquer carta com 【Deploy】 de alvo nomeado
    // (ex.: ST01-004 Guntank, "Choose 1 enemy Unit with 2 or less HP") quebrava
    // com "Alvo nomeado não foi resolvido" ao tentar resolver. Agora: sem alvo
    // legal -> a Base "Add 1 Shield"-style Deploy sem alvo nomeado continua
    // resolvendo na hora (não muda nada pra elas); com alvo nomeado -> pausa
    // como `PendingDecision.abilityResolution`, e se não houver alvo legal o
    // efeito simplesmente não ativa (Comprehensive Rules — não impede a carta
    // de ter sido jogada, ela já está em campo pelos eventos MOVE_CARD acima).
    next = deferOrDispatchAbilities(next, player, "Deploy", [{ code: def.code, instanceId: cardInstanceId }], specs, {
      targets: options.targets,
      predicateResolver: options.predicateResolver,
      targetFilterResolver: options.targetFilterResolver,
    });
    // docs/45 — um 【Deploy】 que matou uma Unit com 【Destroyed】-que-pausa (ex.
    // Rewloola matando Char's Zaku Ⅱ) deixa `pendingDecision` setado: trava aqui.
    if (next.pendingDecision.A || next.pendingDecision.B) return next;
    if (playAsPilot && options.pairWithUnitId) {
      // 【When Paired】 (Unit e/ou Pilot, ST01-002 vs ST01-010) resolvido num
      // momento SEPARADO da escolha da Unit — pausa se optativo/precisa de alvo.
      next = deferOrDispatchAbilities(
        next,
        player,
        "When Paired",
        [
          { code: findCard(next, options.pairWithUnitId).def.code, instanceId: options.pairWithUnitId },
          { code: def.code, instanceId: cardInstanceId },
        ],
        specs,
        { targets: options.targets, predicateResolver: options.predicateResolver, targetFilterResolver: options.targetFilterResolver },
      );
      if (next.pendingDecision.A || next.pendingDecision.B) return next;
      // 【When Linked】 (ST04-011 Athrun Zala) — dispara só quando o pareamento
      // resultante forma uma Link Unit (3-2-6). "this Unit" no texto do Pilot =
      // a Unit pareada; a fonte do EffectSpec é o próprio Pilot.
      const pairedUnit = findCard(next, options.pairWithUnitId);
      if (satisfiesLinkCondition(effectivePilotDef(findCard(next, cardInstanceId)), pairedUnit.def)) {
        next = deferOrDispatchAbilities(
          next,
          player,
          "When Linked",
          [{ code: def.code, instanceId: cardInstanceId }],
          specs,
          { targets: options.targets, predicateResolver: options.predicateResolver, targetFilterResolver: options.targetFilterResolver },
        );
      }
    }
  }

  return next;
}

export interface PlayCommandOptions {
  resourceInstanceIds?: string[];
  targets?: Record<string, string[]>;
  predicateResolver?: PredicateResolver;
  targetFilterResolver?: TargetFilterResolver;
}

/**
 * Joga uma Command da mão. `trigger` distingue se é uma ativação 【Main】
 * (Main Phase, fora de combate) ou 【Action】 (Action Step de um combate,
 * respeitando a prioridade alternada — ver combat.ts). Comprehensive Rules
 * 3-4-4: a carta só vai pro trash depois do efeito terminar de resolver —
 * por isso o `dispatchTrigger` roda antes do MOVE_CARD final.
 */
export function playCommand(
  state: GameState,
  player: PlayerId,
  cardInstanceId: string,
  trigger: "Main" | "Action",
  specs: EffectSpec[],
  options: PlayCommandOptions = {},
): GameState {
  const card = findCard(state, cardInstanceId);
  if (card.owner !== player) throw new Error("Só é possível jogar carta da própria mão");
  if (card.zone !== "hand") throw new Error("Carta precisa estar na mão pra ser jogada");
  if (card.def.cardType !== "COMMAND") throw new Error("playCommand só serve pra Command");
  if (!card.def.triggerKeywords?.includes(trigger)) {
    throw new Error(`${card.def.code} não tem gatilho 【${trigger}】`);
  }

  if (trigger === "Main") {
    if (state.phase !== "main" || state.combat) throw new Error("Command 【Main】 só pode ser jogada na Main Phase, fora de combate");
    if (state.activePlayer !== player) throw new Error("Só o jogador ativo pode jogar Command 【Main】");
  } else {
    // Command 【Action】 pode ser jogada em 2 momentos (Comprehensive Rules): o
    // Action Step de uma batalha (combat.ts) ou o Action Step da End Phase
    // (phases.ts, beginEndPhaseActionStep) — os dois usam a mesma mecânica de
    // prioridade alternada, só a origem do "quem tem prioridade agora" muda.
    const inBattleActionStep = state.combat?.step === "action";
    const inEndPhaseActionStep = state.endPhaseAction !== null;
    if (!inBattleActionStep && !inEndPhaseActionStep) {
      throw new Error("Command 【Action】 só pode ser jogada no Action Step (de uma batalha ou do fim de turno)");
    }
    const priority = inBattleActionStep ? state.combat!.actionPriority : state.endPhaseAction!.priority;
    if (priority !== player) throw new Error("Não é a prioridade desse jogador no Action Step");
  }

  if (!canPayLevel(state, player, card.def)) {
    throw new Error(`Nível insuficiente pra jogar ${card.def.code}: precisa de ${card.def.level ?? 0} recursos em campo`);
  }

  const costEvents = payCostEvents(state, player, card.def, options.resourceInstanceIds);
  let next = applyEvents(state, costEvents);

  // docs/47 Classe A — Command com escolha nomeada (ST04-012 Striker Pack 【Main】:
  // Sword ou Launcher): PAUSA pra a camada de decisão, igual `deployCard`. A
  // carta fica na mão até `resolveAbility` rodar o efeito e mandá-la pro trash
  // (CR 3-4-4). Sem `options.targets` = não veio pré-resolvida (teste/IA).
  const needsChoice = findTriggerSpecs(specs, card.def.code, trigger).some(specNeedsChoice);
  if (needsChoice && !options.targets) {
    next = deferOrDispatchAbilities(next, player, trigger, [{ code: card.def.code, instanceId: cardInstanceId }], specs, {
      predicateResolver: options.predicateResolver,
      targetFilterResolver: options.targetFilterResolver,
    });
    if (next.pendingDecision.A || next.pendingDecision.B) return next;
  }

  // V0 (docs/25): filtra ANTES de despachar — spec com alvo nomeado ilegal ou
  // não escolhido lança (o cliente devia ter restringido as opções); spec sem
  // NENHUM alvo legal agora sai do lote (efeito não ativa, a Command mesmo
  // assim resolve o resto e vai pro trash normalmente logo abaixo).
  const dispatchable = filterDispatchableSpecs(
    next,
    card.def.code,
    trigger,
    specs,
    player,
    options.targets?.target,
    options.targetFilterResolver,
  );
  next = dispatchTrigger(next, cardInstanceId, trigger, dispatchable, {
    targets: options.targets,
    predicateResolver: options.predicateResolver,
    targetFilterResolver: options.targetFilterResolver,
    allSpecs: specs,
  });

  // a carta pode já ter se movido (nenhum EffectSpec de Command faz isso hoje,
  // mas o dispatcher não impede) — só manda pro trash se ainda estiver na mão.
  const stillInHand = next.players[player].hand.some((c) => c.instanceId === cardInstanceId);
  if (stillInHand) {
    next = applyEvents(next, [{ type: "MOVE_CARD", instanceId: cardInstanceId, toZone: "trash" }]);
  }

  return next;
}
