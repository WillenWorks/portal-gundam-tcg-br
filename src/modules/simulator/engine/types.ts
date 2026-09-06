/**
 * Simulador — Fase 1: tipos do motor de partida.
 *
 * Motor puro (sem React), ver docs/18-simulador-fase1-motor-e-dsl.md.
 * Nada aqui depende de rede/Prisma/UI — só estruturas de dado e as
 * funções puras que operam sobre elas (events.ts, phases.ts, combat.ts).
 */

export type PlayerId = "A" | "B";

export const PLAYER_IDS: PlayerId[] = ["A", "B"];

export function otherPlayer(player: PlayerId): PlayerId {
  return player === "A" ? "B" : "A";
}

/**
 * As 9 zonas do motor (ver docs/18, "Modelo de zonas"). `exile` foi
 * adicionada na rodada 5 (pedido do Willen de mostrar uma "área de exílio"
 * visível no tabuleiro) — antes disso, `REMOVE_CARD_FROM_GAME` tirava a
 * carta de qualquer zona sem guardar em lugar nenhum (ela só "desaparecia").
 * Continua sendo uma zona sempre pública (igual trash), ver viewState.ts.
 */
export type Zone =
  | "deck"
  | "resourceDeck"
  | "shields"
  | "resourceArea"
  | "battleArea"
  | "baseSection"
  | "trash"
  | "exile"
  | "hand";

export type CardType = "UNIT" | "PILOT" | "COMMAND" | "BASE" | "RESOURCE";

/**
 * Dado estático de uma carta, já achatado a partir de `CardModel`
 * (ver prisma/schema.prisma e src/lib/gundam-card-effects.ts).
 * A Fase 1 consome só os campos necessários pro motor de regras — não
 * duplica o catálogo inteiro.
 */
export interface CardDef {
  code: string;
  nameEn: string;
  cardType: CardType;
  color: string;
  level?: number;
  cost?: number;
  /**
   * Pilot nativo (`cardType: "PILOT"`): modificador impresso de AP que a Unit
   * pareada ganha enquanto pareada (Comprehensive Rules 3-3-5, sem depender de
   * Link). Unit: AP base. Command: não usado.
   */
  ap?: number;
  hp?: number;
  traits?: string[];
  /**
   * Card Command/Pilot (Comprehensive Rules — carta com 【Command】 e 【Pilot】):
   * `cardType` é "COMMAND", mas a carta pode ser jogada como Command OU pareada
   * como Pilot. Quando pareada, ela age como um Pilot com este nome/stats (o
   * `nameEn`/`ap`/`hp` da carta seguem sendo os do lado Command). A instância
   * jogada nesse modo é marcada com `CardInstance.asPilot`. Ex.: ST01-012
   * Thoroughly Damaged → Pilot "Hayato Kobayashi" AP+0/HP+1.
   */
  pilotMode?: { pilotName: string; ap?: number; hp?: number };
  /** Ex.: ["Deploy", "Attack"] — de CardModel.triggerKeywords */
  triggerKeywords?: string[];
  /** Ex.: ["Blocker", "Repair"] — de CardModel.effectKeywords */
  effectKeywords?: string[];
  /** Ex.: ["Repair 2", "Support 1"] — de CardModel.keywordTags, já com valor extraído */
  keywordTags?: string[];
  hasBurst?: boolean;
  oncePerTurn?: boolean;
  /** true para o EX Resource / EX Base gerados no setup, não fazem parte do deck de 50+10 */
  isToken?: boolean;
  /**
   * Link condition desta Unit (Comprehensive Rules 3-2-6) — só existe em Units,
   * nunca em Pilot/Command/Base. Não restringe o pareamento em si (qualquer Pilot
   * pode parear com qualquer Unit amiga, regra 3-3-1/3-3-4); só decide se o
   * pareamento resultante vira "Link Unit", cujo único bônus mecânico é poder
   * atacar no turno em que foi deployada (3-2-6-3), veja `isLinkUnit`.
   * `kind: "pilotName"` casa por substring no nome do Pilot pareado (regra
   * 3-2-6-4, ex. link "[Amuro Ray]"); `kind: "trait"` casa se o Pilot pareado
   * tiver algum desses traits (ex. link "(OZ) Trait").
   */
  link?: { kind: "pilotName" | "trait"; values: string[] };

  /**
   * Modificador estático contínuo (Comprehensive Rules 10-2) — ao contrário
   * de `StatModifier` (aplicado uma vez, via evento, quando algo acontece),
   * isto é reavaliado a cada consulta de `effectiveAp`/`effectiveHp`: vale
   * enquanto a condição for verdadeira, some sozinho quando deixar de ser
   * (ex.: Pilot desparelha, Link deixa de ser satisfeito), sem precisar de
   * `CLEAR_TURN_MODIFIERS` nem de nenhum evento de "remover buff".
   * `condition` é sobre a carta que TEM esta ability (a fonte); `scope`
   * decide quem recebe o bônus:
   * - "self": a própria fonte (só faz sentido se a fonte for uma Unit).
   * - "pairedUnit": a Unit pareada com esta carta (ability definida no
   *   Pilot, ex. ST02-010 Heero Yuy — "This Unit" no texto é a Unit pareada).
   * - "allFriendlyUnits": toda Unit amiga na Battle Area do controller da
   *   fonte (ex. ST01-001 Gundam — "all your Units").
   */
  staticAbilities?: StaticAbility[];

  /**
   * Habilidade condicionada a 【During Link】 que reage a um evento de
   * combate (não é modificador de stat contínuo — ver `staticAbilities`
   * acima pra isso). Hoje só cobre "destruiu inimigo em batalha" (o único
   * gatilho usado por ST02-003/ST02-011), mas o desenho é genérico o
   * bastante pra outro gatilho futuro reaproveitar. Pode estar tanto numa
   * Unit (`condition: "duringPair"`, ex. ST02-003 Heavyarms) quanto num
   * Pilot (`condition: "duringLink"`, ex. ST02-011 Zechs — "this Unit" =
   * a Unit pareada com o Pilot que tem o campo).
   */
  combatTriggers?: CombatTrigger[];

  /**
   * Restrições/relaxamentos de legalidade da própria declaração de ataque
   * (Attack Step) — não são efeitos que produzem `GameEvent`, são regras de
   * "o que é permitido escolher como alvo" (ver docs/18, lacuna #6).
   */
  attackTargetRules?: {
    /** ex. ST01-009 Zowort: "This Unit can't choose the enemy player as its attack target." */
    cannotTargetPlayer?: boolean;
    /** ex. ST02-001 Wing Gundam: pode escolher Unit inimiga ACTIVE (não só rested) até este level */
    mayTargetActiveEnemyUnit?: { maxLevel: number };
  };
}

export type StaticEffectCondition = "duringPair" | "duringLink";
export type StaticEffectScope = "self" | "pairedUnit" | "allFriendlyUnits";

export interface StaticAbility {
  condition: StaticEffectCondition;
  scope: StaticEffectScope;
  stat: StatKey;
  amount: number;
  /** ex. ST01-001 Gundam: "During Pair, DURING YOUR TURN, all your Units get AP+1" — só vale enquanto for o turno do controller da fonte. Omitido/false = vale sempre (ex. ST02-010 Heero Yuy, sem essa qualificação no texto). */
  duringYourTurnOnly?: boolean;
}

/**
 * Condição de um `CombatTrigger`. `"duringPair"`/`"duringLink"` são as mesmas
 * de `StaticAbility`; `"always"` é pra cláusula de combate que o texto oficial
 * NÃO prende a estar pareada/em Link (ex. ST03-001 Sinanju — "During your turn,
 * when this Unit destroys an enemy shield area card with battle damage ...").
 */
export type CombatTriggerCondition = StaticEffectCondition | "always";

export interface CombatTrigger {
  condition: CombatTriggerCondition;
  /**
   * `destroyEnemyInBattle` — "esta Unit destruiu uma Unit inimiga em batalha"
   * (ST02-003/ST02-011). `destroyEnemyShieldInBattle` — "esta Unit destruiu uma
   * carta da shield area inimiga com dano de batalha" (ST03-001 Sinanju), só no
   * ataque direto ao jogador que consome shield (não Breach).
   */
  on: "destroyEnemyInBattle" | "destroyEnemyShieldInBattle";
  action:
    | { kind: "draw"; amount: number }
    | { kind: "damageAllEnemyUnits"; amount: number; maxLevel?: number }
    /**
     * ST03-001 Sinanju — "choose 1 enemy Unit. Deal 2 damage to it". Sem sistema
     * de decisão em combate (docs/43 §4), o motor AUTO-MIRA a 1ª Unit inimiga
     * legal na Battle Area — determinístico e testável; se/quando o Action Step
     * ganhar escolha real de alvo, isto passa a consumir a escolha do jogador.
     */
    | { kind: "damageChosenEnemyUnit"; amount: number };
}

export type StatKey = "ap" | "hp";
export type Duration = "endOfTurn" | "thisBattle" | "permanent";

export interface StatModifier {
  stat: StatKey;
  amount: number;
  duration: Duration;
  /** turno em que foi aplicado, usado pra limpar "endOfTurn" na End Phase certa */
  appliedOnTurn: number;
}

export interface KeywordGrant {
  keyword: string;
  duration: Duration;
  appliedOnTurn: number;
}

/** Uma cópia física de uma carta em jogo — instância runtime, não o CardDef estático. */
export interface CardInstance {
  instanceId: string;
  def: CardDef;
  owner: PlayerId;
  zone: Zone;
  rested: boolean;
  /** dano marcado (persiste até reparo ou destruição — Comprehensive Rules 5-5-2) */
  damage: number;
  /** pra Units: instanceId do Pilot pareado, se houver */
  pairedPilotId?: string;
  /** pra Pilots: instanceId da Unit pareada, se houver */
  pairedUnitId?: string;
  /** true quando um card Command/Pilot (`def.pilotMode`) foi jogado no modo Pilot (pareado), não no modo Command. Sempre limpo ao sair da Battle Area. */
  asPilot?: boolean;
  statModifiers: StatModifier[];
  keywordGrants: KeywordGrant[];
  /** nomes de keyword [Once per Turn] já usados nesta instância, neste turno */
  usedKeywordsThisTurn: string[];
  /** turno em que entrou na zona atual — usado por regras tipo "Link ataca imediato ao ser deployada" */
  enteredZoneOnTurn: number;
  /**
   * ST04-011 Athrun Zala 【When Linked】 — "During this turn, this Unit may choose
   * an active enemy Unit that is Lv.5 or lower as its attack target." Concessão
   * TEMPORÁRIA (na Unit pareada), diferente de `CardDef.attackTargetRules`
   * (estático, ST02-001 Wing Gundam). `turn` = só vale enquanto
   * `state.turnNumber === turn`; limpo em `CLEAR_TURN_MODIFIERS`.
   */
  attackTargetRelaxUntilTurn?: { maxLevel: number; turn: number };
  /**
   * ST04-015 Archangel 【Activate･Main】 — "It can't attack during this turn."
   * Guarda o `turnNumber` em que a proibição foi imposta; `declareAttack` barra
   * enquanto `=== state.turnNumber`. Limpo em `CLEAR_TURN_MODIFIERS`.
   */
  cannotAttackUntilTurn?: number;
}

/**
 * Comprehensive Rules 3-2-6: a Unit vira "Link Unit" quando o Pilot pareado
 * satisfaz a link condition dela. Não tem efeito em pareamento (isso é livre,
 * 3-3-1/3-3-4) — só decide se a Unit ganha a exceção de atacar no turno em
 * que foi deployada (3-2-6-3, ver `combat.ts`/`declareAttack`).
 */
/** true se esta instância age como Pilot: `cardType: "PILOT"` nativo, ou card Command/Pilot jogado no modo Pilot. */
export function isActingAsPilot(card: CardInstance): boolean {
  return card.def.cardType === "PILOT" || card.asPilot === true;
}

/**
 * `CardDef` "efetivo" de uma carta agindo como Pilot. Um card Command/Pilot
 * jogado no modo Pilot (`asPilot`) responde pelo nome/stats/tipo do bloco
 * 【Pilot】 (`def.pilotMode`) — relevante pra link condition (3-2-6-4) e efeitos
 * que citam um "specified pilot". Pilot nativo devolve o próprio `def`.
 */
export function effectivePilotDef(pilot: CardInstance): CardDef {
  if (pilot.asPilot && pilot.def.pilotMode) {
    return {
      ...pilot.def,
      cardType: "PILOT",
      nameEn: pilot.def.pilotMode.pilotName,
      ap: pilot.def.pilotMode.ap,
      hp: pilot.def.pilotMode.hp,
    };
  }
  return pilot.def;
}

/**
 * Modificador de AP/HP que um Pilot pareado concede à Unit (Comprehensive
 * Rules 3-3-5): enquanto pareada, a Unit ganha o AP/HP impresso do Pilot, sem
 * depender de Link. Pilot nativo usa `def.ap`/`def.hp`; um card Command/Pilot
 * no modo Pilot (`asPilot`) usa o bloco `def.pilotMode`.
 */
export function pilotStatModifier(pilot: CardInstance, stat: StatKey): number {
  if (pilot.asPilot && pilot.def.pilotMode) {
    return (stat === "ap" ? pilot.def.pilotMode.ap : pilot.def.pilotMode.hp) ?? 0;
  }
  if (pilot.def.cardType === "PILOT") {
    return (stat === "ap" ? pilot.def.ap : pilot.def.hp) ?? 0;
  }
  return 0;
}

export function satisfiesLinkCondition(pilotDef: CardDef, unitDef: CardDef): boolean {
  const link = unitDef.link;
  if (!link) return false;
  if (link.kind === "pilotName") {
    return link.values.some((name) => pilotDef.nameEn.includes(name));
  }
  return link.values.some((trait) => (pilotDef.traits ?? []).includes(trait));
}

/** Busca só dentro da Battle Area de `owner` — pareamento (Pilot<->Unit) só existe ali, então isso evita depender de `findCard` (events.ts), que importaria de volta `types.ts` (ciclo). */
function findInBattleArea(state: GameState, owner: PlayerId, instanceId: string): CardInstance | undefined {
  return state.players[owner].battleArea.find((c) => c.instanceId === instanceId);
}

function isStaticAbilityActive(state: GameState, source: CardInstance, condition: StaticEffectCondition): boolean {
  if (condition === "duringPair") {
    if (source.def.cardType === "UNIT") return !!source.pairedPilotId;
    if (isActingAsPilot(source)) return !!source.pairedUnitId;
    return false;
  }
  // duringLink: precisa achar o outro lado do pareamento e checar satisfiesLinkCondition (3-2-6)
  if (source.def.cardType === "UNIT" && source.pairedPilotId) {
    const pilot = findInBattleArea(state, source.owner, source.pairedPilotId);
    return !!pilot && satisfiesLinkCondition(effectivePilotDef(pilot), source.def);
  }
  if (isActingAsPilot(source) && source.pairedUnitId) {
    const unit = findInBattleArea(state, source.owner, source.pairedUnitId);
    return !!unit && satisfiesLinkCondition(effectivePilotDef(source), unit.def);
  }
  return false;
}

function computeStaticStatBonus(target: CardInstance, state: GameState, stat: StatKey): number {
  let bonus = 0;
  const owner = state.players[target.owner];
  for (const source of owner.battleArea) {
    for (const ability of source.def.staticAbilities ?? []) {
      if (ability.stat !== stat) continue;
      if (!isStaticAbilityActive(state, source, ability.condition)) continue;
      if (ability.duringYourTurnOnly && source.owner !== state.activePlayer) continue;
      const includesTarget =
        ability.scope === "allFriendlyUnits"
          ? target.def.cardType === "UNIT"
          : ability.scope === "pairedUnit"
            ? source.pairedUnitId === target.instanceId
            : source.instanceId === target.instanceId; // "self"
      if (includesTarget) bonus += ability.amount;
    }
  }
  return bonus;
}

/**
 * Bônus de AP/HP do Pilot pareado (Comprehensive Rules 3-3-5 — sempre ativo
 * enquanto pareado, não depende de Link). O Pilot é resolvido a partir de
 * `state` (Battle Area do dono); a UI, que às vezes chama sem `state`, pode
 * passar o Pilot direto em `pairedPilot` (ele já o tem em mãos, ver BattleSlot).
 */
function resolvePilotStatBonus(
  card: CardInstance,
  stat: StatKey,
  state?: GameState,
  pairedPilot?: CardInstance | null,
): number {
  if (card.def.cardType !== "UNIT" || !card.pairedPilotId) return 0;
  const pilot =
    pairedPilot ??
    (state ? state.players[card.owner].battleArea.find((c) => c.instanceId === card.pairedPilotId) : undefined);
  return pilot ? pilotStatModifier(pilot, stat) : 0;
}

/**
 * `state` é opcional só pra não quebrar callers que ainda não têm acesso a
 * ele (ex. algum teste sintético isolado) — sempre que disponível, passe-o:
 * sem `state` (e sem `pairedPilot`), bônus estáticos (`staticAbilities`, ex.
 * 【During Pair】/【During Link】) e o modificador do Pilot pareado não são
 * computados, e o resultado fica incompleto.
 */
export function effectiveAp(card: CardInstance, state?: GameState, pairedPilot?: CardInstance | null): number {
  const base = card.def.ap ?? 0;
  const bonus = card.statModifiers
    .filter((m) => m.stat === "ap")
    .reduce((sum, m) => sum + m.amount, 0);
  const staticBonus = state ? computeStaticStatBonus(card, state, "ap") : 0;
  const pilotBonus = resolvePilotStatBonus(card, "ap", state, pairedPilot);
  return Math.max(0, base + bonus + staticBonus + pilotBonus);
}

export function effectiveHp(card: CardInstance, state?: GameState, pairedPilot?: CardInstance | null): number {
  const base = card.def.hp ?? 0;
  const bonus = card.statModifiers
    .filter((m) => m.stat === "hp")
    .reduce((sum, m) => sum + m.amount, 0);
  const staticBonus = state ? computeStaticStatBonus(card, state, "hp") : 0;
  const pilotBonus = resolvePilotStatBonus(card, "hp", state, pairedPilot);
  return Math.max(0, base + bonus + staticBonus + pilotBonus);
}

export function hasKeyword(card: CardInstance, keyword: string): boolean {
  const fromDef = card.def.effectKeywords?.includes(keyword) ?? false;
  const fromGrant = card.keywordGrants.some((g) => g.keyword === keyword);
  return fromDef || fromGrant;
}

/**
 * Extrai o valor numérico de uma keyword tipo "Repair 2" -> 2. Retorna null
 * se a keyword não existir. Checa `keywordGrants` (concedida em tempo de
 * jogo, ex. `<Breach 3>` de um EffectSpec via GRANT_KEYWORD) antes de
 * `def.keywordTags` (estático, da definição da carta) — sem isso, uma
 * keyword numérica concedida dinamicamente teria `hasKeyword` retornando
 * true mas `keywordValue` nunca achando o valor real (caía no fallback "0"
 * por não olhar `keywordGrants" — bug encontrado ao autorar ST02-012
 * "Simultaneous Fire", que concede `<Breach 3>` via Main).
 */
export function keywordValue(card: CardInstance, keyword: string): number | null {
  const grant = card.keywordGrants.find((g) => g.keyword.toLowerCase().startsWith(keyword.toLowerCase()));
  if (grant) {
    const match = grant.keyword.match(/(-?\d+)/);
    return match ? Number(match[1]) : 0;
  }
  const tag = card.def.keywordTags?.find((t) => t.toLowerCase().startsWith(keyword.toLowerCase()));
  if (!tag) return hasKeyword(card, keyword) ? 0 : null;
  const match = tag.match(/(-?\d+)/);
  return match ? Number(match[1]) : 0;
}

export type Phase = "start" | "draw" | "resource" | "main" | "end";

export const PHASE_ORDER: Phase[] = ["start", "draw", "resource", "main", "end"];

export type CombatStep = "attack" | "block" | "action" | "damage" | "battleEnd";

export type AttackTarget = "player" | { unitId: string };

/**
 * Decisão interativa pendente de UM jogador (docs/19, Sessão 2). O motor
 * puro PAUSA e escreve isto em `GameState.pendingDecision[player]` quando
 * chega num ponto que exige escolha real de quem está jogando (ativar Burst
 * de uma shield quebrada, ordenar gatilhos simultâneos, escolher alvo de uma
 * habilidade). Enquanto `pendingDecision[player]` não for `null`, é a vez
 * DAQUELE jogador resolver — nenhuma outra ação avança o estado. O
 * `server/matchStore.ts` lê isto em `decisionOwner()` pra saber de quem é o
 * relógio; o `viewState` repassa pros dois lados (o oponente vê que há uma
 * decisão pendente, mas o conteúdo só embute `instanceId`/carta já pública).
 */
/**
 * Uma Unit que saiu da Battle Area pro trash durante um Damage Step (morte de
 * batalha, Breach letal, combatTrigger letal). `wasPaired` é capturado ANTES do
 * `DESTROY_CARD` (a Unit perde `pairedPilotId` ao ir pro trash) — habilita o
 * gate 【During Pair】【Destroyed】 (ST04-009 Miguel's Ginn).
 */
export interface DestroyedInBattle {
  instanceId: string;
  owner: PlayerId;
  wasPaired: boolean;
}

export type PendingDecision =
  | {
      kind: "burst";
      /** shield quebrada agora, com 【Burst】, aguardando ativar ou mandar pro trash */
      cardInstanceId: string;
      cardDef: CardDef;
      /** rótulos de sub-efeito quando o Burst tem modos (hoje sempre `[]` — Burst é ativar/recusar) */
      choices: string[];
      /** outras shields quebradas no MESMO Damage Step, ainda por decidir (fila FIFO) — resolvida uma por vez */
      queuedInstanceIds: string[];
      /**
       * 【Destroyed】 das Units destruídas no MESMO Damage Step (docs/44). O
       * 【Burst】 resolve primeiro (fila FIFO acima); quando ela esvazia,
       * `resolveBurstDecision` dispara estes 【Destroyed】 antes do Battle End
       * Step (Comprehensive Rules — 【Burst】 e 【Destroyed】 são simultâneos; o
       * jogador ativo ordena — aqui fixamos 【Burst】→【Destroyed】). Ver
       * `collectDestroyedInBattle`/`dispatchDestroyedTriggers`.
       */
      pendingDestroyed?: DestroyedInBattle[];
    }
  | {
      kind: "triggerOrder";
      /** `trigger` = rótulo do textSectionsJson ("Deploy"/"Destroyed"/...) que o dispatcher usa; `label` = texto pra UI. */
      triggers: Array<{ instanceId: string; specId: string; trigger: string; label: string }>;
    }
  | {
      /**
       * Gatilho(s) de habilidade resolvidos num momento SEPARADO da ação que os
       * disparou (【When Paired】 ao parear Piloto, 【Attack】 ao declarar ataque,
       * 【Deploy】 direcionado, …). A fila pode ter mais de 1 efeito simultâneo
       * (When Paired da Unit + do Piloto): o jogador escolhe a ORDEM (não é
       * cadeia, é ordenação de eventos) e, pra efeito `optional`, se ativa ou
       * pula. `needsTarget` = o efeito consome `ctx.targets.target`;
       * `targetScope` diz a categoria ampla do alvo; `legalTargets` (V0,
       * 2026-09-04) é a lista JÁ FILTRADA pelo `targetFilter` do EffectSpec
       * (HP/nível/descansada/etc.), calculada uma vez no servidor ao montar a
       * fila — a UI só lê, nunca recalcula a regra; `resolveAbility` valida
       * contra ela (não confia cegamente no que o cliente manda).
       */
      kind: "abilityResolution";
      trigger: string;
      queue: Array<{
        sourceInstanceId: string;
        specId: string;
        /** `sourceText` do EffectSpec — texto pra UI. */
        label: string;
        optional: boolean;
        needsTarget: boolean;
        targetScope: "enemyUnit" | "ownResource" | "friendlyUnit";
        /** instanceIds já legais AGORA pra este alvo (escopo + `targetFilter` aplicados) — `[]` = nenhum alvo legal, o efeito não ativa. */
        legalTargets: string[];
        /**
         * ST03-010 Full Frontal 【When Paired】 — "You may deploy 1 (Neo Zeon)/(Zeon)
         * Unit card Lv.4 or lower from your hand." O jogador escolhe 1 carta da
         * própria mão (não uma carta em campo, por isso não é `legalTargets`).
         * `legalHandIds` é calculado no servidor ao montar a fila (mão do
         * controller que casa o filtro trait/nível e é Unit); `resolveAbility`
         * valida contra ele. Presente só quando o spec usa `deployFromHandTriggered`.
         * A escolha viaja em `resolution.targetIds` (0 ou 1 id) e vira
         * `ctx.targets.deploy`.
         */
        handChoice?: { legalHandIds: string[]; label: string };
        /**
         * ST03-006 Char's Zaku Ⅱ 【Destroyed】 — "Look at the top 3 cards of your
         * deck. You may reveal 1 (Zeon)/(Neo Zeon) Unit card among them and add it
         * to your hand. Return the remaining cards randomly to the bottom." O dono
         * vê todas as `topCards` (instâncias embutidas — a redação de `viewState`
         * as esvazia pro oponente, já que o topo do deck é oculto); `revealableIds`
         * é o subconjunto que casa o filtro (revela 1 dessas OU nenhuma). A escolha
         * viaja em `resolution.targetIds` (0 ou 1 id) e vira `ctx.targets.reveal`.
         * "Não revelar" ainda dispara o efeito (as N cartas vão pro fundo).
         */
        deckTopReveal?: { topCards: CardInstance[]; revealableIds: string[]; count: number; label: string };
      }>;
      /**
       * docs/45 — 【Destroyed】 que PAUSA do OUTRO jogador, disparado no MESMO
       * evento (efeito AoE que matou Units-com-【Destroyed】-que-pausa dos dois
       * lados). FIFO: a decisão do jogador ativo resolve primeiro (esta); ao
       * fechá-la, `resolveAbility` dispara a do oponente. Mesma ideia de
       * `queuedInstanceIds`/`pendingDestroyed` do 【Burst】. Cross-player raríssimo
       * (exige 2 Char's Zaku Ⅱ, uma de cada lado, mortas por um único AoE que
       * atinge os dois — nenhuma carta ST01–ST04 faz isso).
       */
      queuedDestroyed?: { owner: PlayerId; sources: Array<{ code: string; instanceId: string }> };
    }
  | {
      /**
       * Mulligan de início de partida (Comprehensive Rules 6-2 / ruling oficial:
       * "once, starting with Player One"). Sequencial: o motor seta isto pro 1º
       * jogador; ao resolver, seta pro 2º; ao resolver o 2º, coloca os 6 shields
       * de cada lado + EX Base + EX Resource e avança pra Main Phase. Sem
       * payload — a mão do próprio jogador já é visível a ele no `viewState`.
       */
      kind: "mulligan";
    }
  | {
      /**
       * Rules management (V2, docs/27 — Comprehensive Rules, "How many Units
       * can I have in my battle area at once? Six at most. If a seventh would
       * enter... you must immediately choose one already there and send it to
       * the trash — and that one isn't treated as 'destroyed'"). Achado real:
       * `deployCard` bloqueava a jogada com erro (impede a carta de ser jogada
       * — errado, mesma classe de bug do Guntank/V0) e `SPAWN_TOKEN` (White
       * Base/Corsica Base) não checava limite nenhum. Corrigido genericamente:
       * QUALQUER ação que resulte em >6 Units na Battle Area de um jogador
       * pausa e pede a escolha, nunca bloqueia a ação que causou o excesso.
       */
      kind: "zoneOverflow";
      zone: "battleArea";
      /** instanceIds das próprias Units na Battle Area agora — sempre >6 no momento em que esta decisão é criada. */
      legalTargets: string[];
    };

export interface CombatState {
  step: CombatStep;
  attackerId: string;
  attackingPlayer: PlayerId;
  defendingPlayer: PlayerId;
  /** alvo declarado no Attack Step — jogador ou Unit inimiga rested */
  originalTarget: AttackTarget;
  /** pode mudar se <Blocker> for ativado no Block Step */
  currentTarget: AttackTarget;
  blockerUsedBy?: string;
  /** Action Step: cada jogador passa até os dois passarem em sequência */
  actionPasses: Record<PlayerId, boolean>;
  /** jogador que deve agir no Action Step agora (começa pelo jogador em espera) */
  actionPriority: PlayerId;
  /**
   * ST02-013 Peaceful Timbre: "During this battle, your shield area cards
   * can't receive damage from enemy Units that are Lv.4 or lower." Vive em
   * `combat`, não em `GameState` direto, porque dura só "esta batalha" — some
   * sozinho quando `COMBAT_ENDED` zera `state.combat` (Battle End Step), sem
   * precisar de mais nenhuma limpeza. Só protege `defendingPlayer` (o único
   * jogador cujos shields podem receber dano nesta batalha).
   */
  shieldProtection?: { maxAttackerLevel: number } | null;
  /**
   * ST03-014 The Blue Giant 【Action】 — "Choose 1 friendly Unit. It can't receive
   * battle damage from enemy Units with 2 or less AP during this battle." Mesma
   * ideia de `shieldProtection` (vive em `combat`, some com `COMBAT_ENDED`), mas
   * por Unit específica e condicionada ao AP EFETIVO do atacante. Só 1 Unit
   * protegida por vez (o texto escolhe 1); o atacante ainda recebe o dano dele.
   */
  unitDamageProtection?: { instanceId: string; maxAttackerAp: number } | null;
}

/**
 * Action Step do fim de turno (Comprehensive Rules 7-6: a End Phase tem 4
 * passos — action step, end step, hand step, cleanup step, nessa ordem).
 * Mesma mecânica de prioridade alternada do Action Step de combate
 * (combat.ts), só que sem attacker/defender — começa pelo jogador em espera
 * (quem não é o `activePlayer`) e serve pra ativar Command 【Action】/efeitos
 * 【Activate·Action】 antes do End Step (Repair)/Hand Step (descarte)/Cleanup
 * Step (limpa modificadores) rodarem.
 */
export interface EndPhaseActionState {
  passes: Record<PlayerId, boolean>;
  /** jogador que deve agir agora (começa pelo jogador em espera, igual ao Action Step de combate) */
  priority: PlayerId;
}

export interface PlayerState {
  id: PlayerId;
  deck: CardInstance[];
  resourceDeck: CardInstance[];
  shields: CardInstance[];
  resourceArea: CardInstance[];
  battleArea: CardInstance[];
  baseSection: CardInstance[];
  trash: CardInstance[];
  /** Cartas removidas do jogo (ex.: EX Resource usado pra pagar custo) — sempre pública, nunca some de vez. */
  exile: CardInstance[];
  hand: CardInstance[];
}

export interface GameOverInfo {
  winner: PlayerId;
  /**
   * "abandonment" e "resignation" nunca são produzidas pelo motor puro — só
   * existem porque o servidor (matchStore.ts, passo 4 do docs/18) precisa
   * encerrar uma partida por um motivo que não é regra de jogo: "resignation"
   * = o jogador clicou "Desistir"; "abandonment" = W.O. por inatividade
   * (botão do oponente ou auto-forfeit AFK). Mantidas aqui, não num tipo à
   * parte no servidor, porque `GameOverInfo` já é o único formato de "fim de
   * jogo" que `ViewGameState`/a UI conhecem — criar um 2º formato só pra isso
   * duplicaria a renderização de fim de jogo no cliente sem necessidade.
   */
  reason: "deckOut" | "noShieldsBattleDamage" | "abandonment" | "resignation";
}

export interface GameState {
  turnNumber: number;
  activePlayer: PlayerId;
  phase: Phase;
  combat: CombatState | null;
  /** não-nulo só durante o Action Step da End Phase (ver EndPhaseActionState) */
  endPhaseAction: EndPhaseActionState | null;
  /**
   * Decisão interativa pendente por jogador (docs/19, Sessão 2 — ver
   * `PendingDecision`). `null` pros dois = ninguém tem decisão travada.
   * No máximo um lado tem decisão pendente por vez no fluxo atual (Burst só
   * do defensor; triggerOrder/targetSelection só de quem controla o efeito).
   */
  pendingDecision: Record<PlayerId, PendingDecision | null>;
  players: Record<PlayerId, PlayerState>;
  eventLog: GameEvent[];
  gameOver: GameOverInfo | null;
  /** contador monotônico usado pra gerar instanceId determinístico (facilita teste) */
  nextInstanceSeq: number;
  /**
   * Seed do `createRng` da partida. Guardado no estado porque o RNG do
   * `createGame` morre no fim dele — mas o Mulligan interativo (Comprehensive
   * Rules 6-2) precisa RE-embaralhar o deck DEPOIS, quando o jogador decide.
   * Determinístico: `createRng(seed ^ nonce)` por jogador. Também sobrevive a
   * restart do servidor (persistência da Sprint C).
   */
  seed: number;
}

// ---------------------------------------------------------------------------
// Eventos — todo efeito de estado é expresso como evento antes de ser
// aplicado (ver docs/18, "DSL de efeitos — desenho proposto"). Isso deixa o
// motor testável por comparação de eventos gerados, e serve de base pronta
// pra log/replay quando a Fase 3 precisar de histórico auditável.
// ---------------------------------------------------------------------------

export type GameEvent =
  | { type: "PHASE_CHANGE"; phase: Phase }
  | { type: "TURN_CHANGE"; turnNumber: number; activePlayer: PlayerId }
  | { type: "DRAW_CARD"; player: PlayerId; from: "deck" | "resourceDeck"; instanceId: string | null }
  | { type: "MOVE_CARD"; instanceId: string; toZone: Zone }
  | { type: "REST_CARD"; instanceId: string }
  | { type: "SET_ACTIVE"; instanceId: string }
  | { type: "DAMAGE_UNIT"; instanceId: string; amount: number }
  | { type: "HEAL_UNIT"; instanceId: string; amount: number }
  | { type: "DESTROY_CARD"; instanceId: string }
  | { type: "REMOVE_CARD_FROM_GAME"; instanceId: string }
  | { type: "DAMAGE_SHIELD"; player: PlayerId; count: number }
  | { type: "DAMAGE_BASE"; instanceId: string; amount: number }
  | { type: "MODIFY_STAT"; instanceId: string; modifier: StatModifier }
  | { type: "GRANT_KEYWORD"; instanceId: string; grant: KeywordGrant }
  | { type: "CLEAR_TURN_MODIFIERS"; turnNumber: number }
  | { type: "MARK_KEYWORD_USED"; instanceId: string; keyword: string }
  | { type: "DISCARD_TO_HAND_LIMIT"; player: PlayerId; instanceIds: string[] }
  | { type: "PAIR_CARDS"; pilotId: string; unitId: string; asPilotMode?: boolean }
  /** Cria uma instância nova em jogo a partir de um `CardDef` (token) — CR 3-1. Nunca usado no setup (setup.ts instancia direto); só por efeito de carta em tempo de jogo. */
  | { type: "SPAWN_TOKEN"; player: PlayerId; def: CardDef; zone: Zone; rested?: boolean }
  /** Reordena 1 carta dentro do próprio deck do jogador (ex.: "look at the top N, return 1 to the top and 1 to the bottom") sem trocar de zona. */
  | { type: "MOVE_WITHIN_DECK"; instanceId: string; position: "top" | "bottom" }
  /** ST02-013 Peaceful Timbre — ver `CombatState.shieldProtection`. Não-op se não houver combate em andamento. */
  | { type: "SET_SHIELD_PROTECTION"; maxAttackerLevel: number }
  /** ST03-014 The Blue Giant — ver `CombatState.unitDamageProtection`. Não-op fora de combate. */
  | { type: "SET_UNIT_DAMAGE_PROTECTION"; instanceId: string; maxAttackerAp: number }
  /** ST04-011 Athrun Zala — ver `CardInstance.attackTargetRelaxUntilTurn`. */
  | { type: "GRANT_ATTACK_TARGET_RELAX"; instanceId: string; maxLevel: number; turn: number }
  /** ST04-015 Archangel — ver `CardInstance.cannotAttackUntilTurn`. */
  | { type: "SET_CANNOT_ATTACK"; instanceId: string; turn: number }
  | { type: "ATTACK_DECLARED"; attackerId: string; attackingPlayer: PlayerId; defendingPlayer: PlayerId; target: AttackTarget }
  | { type: "BLOCK_DECLARED"; blockerId: string; newTarget: AttackTarget }
  | { type: "ACTION_PASS"; player: PlayerId }
  | { type: "COMBAT_STEP_CHANGE"; step: CombatStep }
  | { type: "COMBAT_ENDED" }
  | { type: "BEGIN_END_PHASE_ACTION_STEP"; priority: PlayerId }
  | { type: "END_PHASE_ACTION_PASS"; player: PlayerId }
  | { type: "END_END_PHASE_ACTION_STEP" }
  /** docs/19 Sessão 2 — grava/limpa a decisão interativa pendente de um jogador (ver `PendingDecision`). */
  | { type: "SET_PENDING_DECISION"; player: PlayerId; decision: PendingDecision }
  | { type: "CLEAR_PENDING_DECISION"; player: PlayerId }
  | { type: "GAME_OVER"; winner: PlayerId; reason: GameOverInfo["reason"] };
