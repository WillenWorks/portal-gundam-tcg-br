import type { CardDef, GameEvent, GameState, PlayerId } from "./types";
import { applyEvents, findCard } from "./events";
import type { EffectSpec, PredicateResolver } from "./effectSpec";
import { dispatchTrigger } from "./dispatcher";

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
 * - Command não usa esta função — ver `playCommand()` abaixo (ele resolve o
 *   efeito e só depois vai pro trash, Comprehensive Rules 3-4-4).
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
}

export function canPayLevel(state: GameState, player: PlayerId, def: CardDef): boolean {
  return state.players[player].resourceArea.length >= (def.level ?? 0);
}

function payCostEvents(state: GameState, player: PlayerId, def: CardDef, resourceInstanceIds?: string[]): GameEvent[] {
  const cost = def.cost ?? 0;
  const resourceArea = state.players[player].resourceArea;
  const activeResources = resourceArea.filter((r) => !r.rested);
  const payWith = resourceInstanceIds ?? activeResources.slice(0, cost).map((r) => r.instanceId);

  if (payWith.length < cost) {
    throw new Error(`Recursos active insuficientes pra pagar custo ${cost}: só ${activeResources.length} active`);
  }
  for (const id of payWith) {
    const resource = findCard(state, id);
    if (resource.owner !== player || resource.zone !== "resourceArea") {
      throw new Error(`Recurso ${id} inválido pra pagar custo (precisa ser Recurso do próprio jogador na Resource Area)`);
    }
    if (resource.rested) {
      throw new Error(`Recurso ${id} já está rested, não pode pagar custo de novo`);
    }
  }
  return payWith.map((id): GameEvent => ({ type: "REST_CARD", instanceId: id }));
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
  if (def.cardType === "COMMAND") throw new Error("Command não usa deployCard — ver playCommand()");
  if (def.cardType === "RESOURCE") throw new Error("Resource não é jogado da mão via deployCard — é comprado na Resource Phase");

  if (!canPayLevel(state, player, def)) {
    throw new Error(
      `Nível insuficiente pra jogar ${def.code}: precisa de ${def.level ?? 0} recursos em campo, tem ${state.players[player].resourceArea.length}`,
    );
  }

  const events: GameEvent[] = payCostEvents(state, player, def, options.resourceInstanceIds);

  if (def.cardType === "UNIT") {
    const unitCount = state.players[player].battleArea.filter((c) => c.def.cardType === "UNIT").length;
    if (unitCount >= 6) throw new Error("Battle Area cheia (máx. 6 Units, Comprehensive Rules)");
    events.push({ type: "MOVE_CARD", instanceId: cardInstanceId, toZone: "battleArea" });
  } else if (def.cardType === "BASE") {
    const existing = state.players[player].baseSection[0];
    if (existing) {
      // regra confirmada: a Base excedente vai pro trash, mas NÃO é "destruída" —
      // por isso MOVE_CARD, nunca DESTROY_CARD (não dispara gatilho Destroyed).
      events.push({ type: "MOVE_CARD", instanceId: existing.instanceId, toZone: "trash" });
    }
    events.push({ type: "MOVE_CARD", instanceId: cardInstanceId, toZone: "baseSection" });
  } else if (def.cardType === "PILOT") {
    if (!options.pairWithUnitId) throw new Error("Pilot precisa de uma Unit amiga escolhida pra parear ao ser jogado (Comprehensive Rules 3-3-1)");
    const unit = findCard(state, options.pairWithUnitId);
    if (unit.owner !== player || unit.zone !== "battleArea") {
      throw new Error("A Unit de pareamento precisa ser amiga e estar na Battle Area");
    }
    if (unit.def.cardType !== "UNIT") throw new Error("Só dá pra parear Pilot com Unit");
    if (unit.pairedPilotId) throw new Error("Essa Unit já tem um Pilot pareado");
    events.push({ type: "MOVE_CARD", instanceId: cardInstanceId, toZone: "battleArea" });
    events.push({ type: "PAIR_CARDS", pilotId: cardInstanceId, unitId: options.pairWithUnitId });
  }

  let next = applyEvents(state, events);

  const specs = options.specs ?? [];
  if (specs.length > 0) {
    next = dispatchTrigger(next, cardInstanceId, "Deploy", specs, { targets: options.targets, predicateResolver: options.predicateResolver });
    if (def.cardType === "PILOT" && options.pairWithUnitId) {
      // 【When Paired】 pode estar na Unit ou no Pilot (ST01-002 vs ST01-010) — dispara os dois lados.
      next = dispatchTrigger(next, options.pairWithUnitId, "When Paired", specs, { targets: options.targets, predicateResolver: options.predicateResolver });
      next = dispatchTrigger(next, cardInstanceId, "When Paired", specs, { targets: options.targets, predicateResolver: options.predicateResolver });
    }
  }

  return next;
}

export interface PlayCommandOptions {
  resourceInstanceIds?: string[];
  targets?: Record<string, string[]>;
  predicateResolver?: PredicateResolver;
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

  next = dispatchTrigger(next, cardInstanceId, trigger, specs, { targets: options.targets, predicateResolver: options.predicateResolver });

  // a carta pode já ter se movido (nenhum EffectSpec de Command faz isso hoje,
  // mas o dispatcher não impede) — só manda pro trash se ainda estiver na mão.
  const stillInHand = next.players[player].hand.some((c) => c.instanceId === cardInstanceId);
  if (stillInHand) {
    next = applyEvents(next, [{ type: "MOVE_CARD", instanceId: cardInstanceId, toZone: "trash" }]);
  }

  return next;
}
