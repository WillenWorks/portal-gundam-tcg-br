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
   * Lote 5 (docs/debates 2026-09-13) — "While <condição de board>, this card in
   * your hand gets cost -N" (ex. GD01-016, GD01-070). Reavaliado a cada consulta
   * de `effectiveCost`, igual ao espírito de `staticAbilities`/`effectiveAp` —
   * some sozinho quando a condição deixa de valer, sem evento de "remover buff".
   * Reusa `StaticBoardCondition` (Lote 3): a "fonte" aqui é a própria carta na
   * MÃO, nunca contada nela mesma (nem excluída à parte — não está em campo/trash).
   */
  dynamicCost?: { condition: StaticBoardCondition; amount: number; perEnemyUnit?: boolean };
  /**
   * Redução ou modificação dinâmica de Nível na mão (ex.: ST08-001 Xi Gundam).
   */
  dynamicLevel?: { condition: StaticBoardCondition; amount: number; perEnemyUnit?: boolean };
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
  /**
   * Lote 5 (docs/debates 2026-09-13) — GD01-091 "During your turn, while this Unit
   * has <Breach>, it can't receive battle damage from enemy Units with 3 or less
   * AP." Proteção CONTÍNUA e INATA (sempre reavaliada, ao contrário de
   * `CombatState.unitDamageProtection` — que é uma proteção TEMPORÁRIA instalada
   * por um efeito pontual tipo ST03-014 The Blue Giant, dura só "esta batalha").
   */
  innateDamageProtection?: {
    maxAttackerAp: number;
    /** ex. "Breach" — a Unit só está protegida enquanto tiver esta keyword agora (própria ou concedida). */
    requiresOwnKeyword?: string;
    /** "During your turn" — só vale enquanto for o turno do CONTROLLER da Unit (não do atacante). */
    duringYourTurnOnly?: boolean;
  };
  /**
   * Lote 5 (docs/debates 2026-09-13) — GD01-090 "【During Link】This Unit's AP can't be
   * reduced by enemy effects." Autorado num PILOT (Duo Maxwell) — "this Unit" é a Unit
   * PAREADA (mesma convenção de GD01-087/089/092/096/091), por isso `effectiveAp`/`effectiveHp`
   * procuram este campo tanto na própria Unit quanto no Pilot pareado com ela.
   */
  innateStatReductionImmunity?: {
    stat: StatKey;
    /** "During Link" — só vale enquanto a Unit satisfizer a link condition com o Pilot pareado (não só "During Pair"). */
    duringLinkOnly?: boolean;
  };
  /**
   * Lote 5 (docs/debates 2026-09-13) — GD01-046 "【During Pair･(Coordinator) Pilot】【Once per
   * Turn】When you use this Unit's <Support> to increase a (ZAFT) Unit's AP, set this Unit as
   * active." Reage ao ATO de ativar a PRÓPRIA `<Support>` (não é um trigger de carta comum tipo
   * Deploy/Attack/Destroyed) — checado direto em `activateSupport` (keywords.ts).
   */
  onSupportUsed?: {
    /** ex. "Coordinator" — o Pilot pareado precisa ter este trait. */
    requiresPairedPilotTrait?: string;
    /** ex. "ZAFT" — o ALVO do Support (quem ganha o AP) precisa ter este trait. */
    requiresTargetTrait?: string;
    oncePerTurn?: boolean;
  };
  /**
   * Lote 5 (docs/debates 2026-09-13) — GD01-002 "When playing this card from your hand,
   * you may destroy 1 of your Link Units with 'Unicorn Mode' in its card name that is
   * Lv.5. If you do, play this card as if it has 0 Lv. and cost." Deploy ALTERNATIVO,
   * validado em `deployCard` (deploy.ts) via `DeployOptions.sacrificeInstanceId` — a
   * Unit sacrificada precisa satisfazer Link (pareada + `satisfiesLinkCondition`) E
   * bater com `nameContains`/`level`. Ausente = carta não tem esse modo (deploy normal
   * sempre paga custo/nível de verdade).
   */
  alternateDeploySacrifice?: {
    /** substring literal do `nameEn` da Unit sacrificada (ex. "Unicorn Mode"). */
    nameContains: string;
    /** nível EXATO exigido da Unit sacrificada. */
    level: number;
  };
  /**
   * Custos e condições alternativas de deploy (GD01/GD03).
   * Permite invocar sem pagar custo/nível normais ao cumprir o requisito especificado
   * (descarte da mão, sacrifício por traço ou nível, ou retorno à mão).
   */
  alternateDeploy?: {
    kind: "sacrifice" | "discard" | "bounce";
    nameContains?: string;
    level?: number;
    trait?: string;
    requiresLink?: boolean;
    discardCount?: number;
  };
  /**
   * Lote 5 (docs/debates 2026-09-13) — GD01-065 "【During Pair】【Once per Turn】When
   * you pair a Pilot with this Unit or one of your white Units, choose 1 enemy Unit.
   * It gets AP-2 during this turn." "this Unit or one of your white Units" colapsa
   * pra "a Unit recém-pareada é branca" (a própria fonte JÁ é branca) — por isso só
   * precisa de `requiresPairedUnitColor`, não 2 fontes separadas. Reage a QUALQUER
   * `PAIR_CARDS` do CONTROLLER (não só quando a própria fonte é pareada) — ver
   * `collectNewPairings`/`dispatchAnyPairingFromEffect` (abilityDispatch.ts),
   * despachados como `EffectSpec.trigger: "AnyPairing"`. `CardDef.oncePerTurn`
   * (campo já existente) cobre o "Once per Turn" — mesmo mecanismo genérico de
   * `dispatchTrigger` usado por qualquer outro trigger.
   */
  onAnyPairing?: {
    /** ausente = reage a QUALQUER cor pareada; presente = só reage se a Unit recém-pareada tiver esta cor. */
    requiresPairedUnitColor?: string;
  };
}

export type StaticEffectCondition = "duringPair" | "duringLink" | "always";
export type StaticEffectScope = "self" | "pairedUnit" | "allFriendlyUnits";

/**
 * Gate adicional de condição de BOARD (não de pareamento) pra `StaticAbility`
 * — Lote 3 (docs/debates 2026-09-13). Reavaliado a cada consulta, junto de
 * `condition`; `"always"` + isto é o caso comum (GD01-019/076/081).
 */
export type StaticBoardCondition =
  /** GD01-019 G-Sky Easy — "While 4 or more enemy Units are in play, ...". */
  | { kind: "enemyUnitCountAtLeast"; n: number }
  /** GD01-076 Zaku II Kai — "While there are 4 or more Command cards in your trash, ...". */
  | { kind: "trashCardTypeCountAtLeast"; cardType: CardType; n: number }
  /** GD01-081 Gundam Aerial — "While you have another (Triple Ship Alliance) Unit in play, ..." ("outra" = exclui a própria fonte). */
  | { kind: "friendlyOtherUnitTraitCountAtLeast"; trait: string; n: number }
  /**
   * GD01-063 Duel Gundam — "while this Unit is battling an enemy Unit that is
   * Lv.2 or lower, ...". Precisa de `excludeInstanceId` = a PRÓPRIA fonte (não
   * "excluir da contagem" como nos outros kinds — aqui é "quem eu sou", pra
   * achar o lado oposto do combate atual). Sem `state.combat`, ou se a fonte
   * não é nenhum dos 2 lados do combate atual, é `false`.
   */
  | { kind: "battlingEnemyLevelAtMost"; maxLevel: number }
  /** ST08-001 Xi Gundam: "While you have no Units that are Lv.6 or higher in play" */
  | { kind: "noUnitLevelAtLeast"; maxLevel: number }
  /** ST07-004 Gundam Virtue / ST07-007 Kyrios: "While you have a (CB) Pilot in play" */
  | { kind: "friendlyUnitWithTraitCountAtLeast"; trait: string; cardType?: CardType; n: number };

/**
 * Gate adicional de condição sobre a carta RECEPTORA do bônus (o alvo de
 * `scope`, não a fonte) — Lote 3. Cobre tanto auto-condição (GD01-054, scope
 * "self") quanto aura de Pilot condicionada à própria Unit pareada (GD01-087/
 * 089/092/096, scope "pairedUnit" — "this Unit" no texto do Pilot é a Unit
 * pareada, não o Pilot).
 */
export type StaticTargetCondition =
  | { kind: "apAtLeast"; n: number }
  | { kind: "colorIs"; color: string }
  | { kind: "traitIs"; trait: string }
  | { kind: "hasKeyword"; keyword: string }
  /** ST05-001/002 — "While this Unit is damaged" (auto-referente, scope: "self"). `damage > 0`. */
  | { kind: "isDamaged" };

export interface StaticAbility {
  condition: StaticEffectCondition;
  scope: StaticEffectScope;
  /** Concede bônus de STAT. Mutuamente exclusivo com `keyword` (uma StaticAbility concede um OU outro; carta com os 2 usa 2 entradas). */
  stat?: StatKey;
  amount?: number;
  /** Concede KEYWORD (ex. `<Blocker>`, `<Breach 3>`) em vez de bônus de stat — Lote 3. Nome BASE só (ex. "Breach"), mesma convenção de `CardDef.effectKeywords`; valor numérico (se houver) vai em `keywordValue`. */
  keyword?: string;
  /** Valor numérico da keyword concedida por `keyword`, ex. 3 pra "<Breach 3>". Omitido = keyword sem valor (ex. "<Blocker>"). */
  keywordValue?: number;
  /** ex. ST01-001 Gundam: "During Pair, DURING YOUR TURN, all your Units get AP+1" — só vale enquanto for o turno do controller da fonte. Omitido/false = vale sempre (ex. ST02-010 Heero Yuy, sem essa qualificação no texto). */
  duringYourTurnOnly?: boolean;
  boardCondition?: StaticBoardCondition;
  targetCondition?: StaticTargetCondition;
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
  /** Lote 5 (docs/debates 2026-09-13) — filtra `destroyEnemyInBattle` pra só disparar se a Unit inimiga destruída ERA Link Unit no momento da destruição (checado ANTES do DESTROY_CARD limpar o pareamento). Ex.: GD01-094 Yzak Jule. */
  requiresLinkUnitEnemy?: boolean;
  /** Lote 5 — "【Once per Turn】" na cláusula de combate (não existe em nenhum CombatTrigger anterior). Marcado via CardInstance.usedKeywordsThisTurn com uma chave sintética (`combatTrigger:<on>`), mesmo mecanismo de <Support>/<Repair> "Once per Turn". */
  oncePerTurn?: boolean;
  action:
    | { kind: "draw"; amount: number }
    | { kind: "damageAllEnemyUnits"; amount: number; maxLevel?: number }
    /**
     * ST03-001 Sinanju — "choose 1 enemy Unit. Deal 2 damage to it". Escolha
     * REAL do jogador (docs/47 Fase 6) — pausa via `combat.pendingTriggerChoices`
     * + `PendingDecision.abilityResolution` quando há ≥1 alvo legal.
     */
    | { kind: "damageChosenEnemyUnit"; amount: number }
    /**
     * ST05-011 Akihiro Altland — "choose 1 (Tekkadan) Unit card that is Lv.2 or
     * lower from your trash. Add it to your hand." (docs/47 Fase 6). Mesmo shape
     * de `CardDefFilter` (effectSpec.ts) — duplicado aqui de propósito: types.ts
     * é a camada base, effectSpec.ts já importa DELE, então importar `CardDefFilter`
     * pra cá criaria import circular. Mantenha os campos em sync se um mudar.
     */
    | { kind: "retrieveFromTrash"; filter: CombatTriggerTrashFilter };
}

/** Ver nota em `CombatTrigger.action` ("retrieveFromTrash") — mesmo shape de `CardDefFilter`. */
export interface CombatTriggerTrashFilter {
  cardType?: CardDef["cardType"];
  anyTrait?: string[];
  maxLevel?: number;
  minLevel?: number;
}

/**
 * docs/47 Fase 6 — gatilho de combate (`damageChosenEnemyUnit`/`retrieveFromTrash`)
 * que precisa de escolha REAL do jogador, capturado em `combat.pendingTriggerChoices`
 * no fim do Damage Step (`combatTriggerEvents`/`resolveDamageStep`, combat.ts) e
 * convertido em `PendingDecision.abilityResolution` por `actions.ts` (`passAction`/
 * `resolveBurstDecision`), DEPOIS de Burst e Destroyed já terem resolvido — mesma
 * ordem (Burst → Destroyed → esta escolha → Battle End) já usada pros outros 2.
 * Sobrevive a `combat` (limpo só em `COMBAT_ENDED`, mesmo espírito de
 * `shieldProtection`/`unitDamageProtection`).
 */
export interface PendingCombatTriggerChoice {
  sourceInstanceId: string;
  action: Extract<CombatTrigger["action"], { kind: "damageChosenEnemyUnit" | "retrieveFromTrash" }>;
  /** enemy Unit ids (`damageChosenEnemyUnit`) OU trash card ids (`retrieveFromTrash`) — já filtrados, prontos pra UI. */
  legalCandidates: string[];
  label: string;
}

export type StatKey = "ap" | "hp";
export type Duration = "endOfTurn" | "thisBattle" | "permanent";

export interface StatModifier {
  stat: StatKey;
  amount: number;
  duration: Duration;
  /** turno em que foi aplicado, usado pra limpar "endOfTurn" na End Phase certa */
  appliedOnTurn: number;
  /**
   * Lote 5 (docs/debates 2026-09-13) — quem CAUSOU este modificador (o controller do
   * efeito/keyword que o aplicou), não o dono da carta modificada. Opcional: ausente =
   * origem desconhecida (nunca filtrado por `innateStatReductionImmunity`, mesmo
   * comportamento de antes desta extensão). Só usado hoje pra GD01-090 distinguir
   * "reduzido por efeito INIMIGO" de "reduzido por efeito PRÓPRIO".
   */
  appliedBy?: PlayerId;
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
  attackTargetRelaxUntilTurn?: { maxLevel?: number; maxAp?: number; turn: number };
  /**
   * ST04-015 Archangel 【Activate･Main】 — "It can't attack during this turn."
   * Guarda o `turnNumber` em que a proibição foi imposta; `declareAttack` barra
   * enquanto `=== state.turnNumber`. Limpo em `CLEAR_TURN_MODIFIERS`.
   */
  cannotAttackUntilTurn?: number;
  /**
   * ST08-009 Jegan Ground Type-A 【Deploy】 — "It won't be set as active during
   * the start phase of your opponent's next turn." Guarda o `turnNumber` do
   * turno em que a Unit alvo NÃO deve ser destombada em `computeStartPhaseEvents`
   * (sempre "próximo turno do oponente" a partir de quem controla Jegan, ou
   * seja `state.turnNumber + 1` no momento do Deploy — ver `effectSpec.ts`
   * case `preventActivationNextTurn`). Consumido (checado com `===`) na Start
   * Phase; limpo em `CLEAR_TURN_MODIFIERS` como os campos irmãos acima.
   */
  cannotActivateUntilTurn?: number;
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
  if (condition === "always") return true;
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

/**
 * Gate de `StaticAbility.boardCondition` (Lote 3) — condição sobre o estado do
 * board, não sobre pareamento. `excludeInstanceId` (opcional) exclui a própria
 * fonte da contagem de "outra Unit amiga com trait X" (Lote 3, ex. GD01-081);
 * omitido = não exclui ninguém (Lote 5 `CardDef.dynamicCost`, cuja "fonte" é
 * uma carta na MÃO — nunca aparece na Battle Area/trash contados, então excluir
 * seria um no-op de qualquer forma).
 */
export function isBoardConditionMet(
  state: GameState,
  owner: PlayerId,
  cond: StaticBoardCondition,
  excludeInstanceId?: string,
): boolean {
  if (cond.kind === "enemyUnitCountAtLeast") {
    const opponent = state.players[otherPlayer(owner)];
    return opponent.battleArea.filter((c) => c.def.cardType === "UNIT").length >= cond.n;
  }
  if (cond.kind === "trashCardTypeCountAtLeast") {
    const ownerState = state.players[owner];
    return ownerState.trash.filter((c) => c.def.cardType === cond.cardType).length >= cond.n;
  }
  if (cond.kind === "battlingEnemyLevelAtMost") {
    const combat = state.combat;
    if (!combat || !excludeInstanceId) return false;
    let enemyId: string | undefined;
    if (combat.attackerId === excludeInstanceId && combat.currentTarget !== "player") enemyId = combat.currentTarget.unitId;
    else if (combat.currentTarget !== "player" && combat.currentTarget.unitId === excludeInstanceId) enemyId = combat.attackerId;
    if (!enemyId) return false;
    const enemy = state.players[otherPlayer(owner)].battleArea.find((c) => c.instanceId === enemyId);
    return !!enemy && (enemy.def.level ?? 0) <= cond.maxLevel;
  }
  if (cond.kind === "noUnitLevelAtLeast") {
    const ownerState = state.players[owner];
    return !ownerState.battleArea.some((c) => c.def.cardType === "UNIT" && (c.def.level ?? 0) >= cond.maxLevel);
  }
  if (cond.kind === "friendlyUnitWithTraitCountAtLeast") {
    const ownerState = state.players[owner];
    return (
      ownerState.battleArea.filter(
        (c) => (cond.cardType ? c.def.cardType === cond.cardType : true) && (c.def.traits ?? []).includes(cond.trait),
      ).length >= cond.n
    );
  }
  // friendlyOtherUnitTraitCountAtLeast — "outra" Unit amiga = exclui a própria fonte, se dada.
  const ownerState = state.players[owner];
  return (
    ownerState.battleArea.filter(
      (c) => c.instanceId !== excludeInstanceId && c.def.cardType === "UNIT" && (c.def.traits ?? []).includes(cond.trait),
    ).length >= cond.n
  );
}

/** Gate de `StaticAbility.targetCondition` (Lote 3) — condição sobre a carta RECEPTORA do bônus (o alvo de `scope`, não a fonte). */
function isTargetConditionMet(target: CardInstance, state: GameState, cond: StaticTargetCondition): boolean {
  if (cond.kind === "apAtLeast") return effectiveAp(target, state) >= cond.n;
  if (cond.kind === "colorIs") return target.def.color === cond.color;
  if (cond.kind === "traitIs") return (target.def.traits ?? []).includes(cond.trait);
  if (cond.kind === "isDamaged") return target.damage > 0;
  return hasKeyword(target, cond.keyword, state);
}

function matchesStaticScope(source: CardInstance, target: CardInstance, scope: StaticEffectScope): boolean {
  if (scope === "allFriendlyUnits") return target.def.cardType === "UNIT";
  if (scope === "pairedUnit") return source.pairedUnitId === target.instanceId;
  return source.instanceId === target.instanceId; // "self"
}

function computeStaticStatBonus(target: CardInstance, state: GameState, stat: StatKey): number {
  let bonus = 0;
  const owner = state.players[target.owner];
  for (const source of owner.battleArea) {
    for (const ability of source.def.staticAbilities ?? []) {
      if (ability.stat !== stat || ability.amount === undefined) continue;
      if (!isStaticAbilityActive(state, source, ability.condition)) continue;
      if (ability.duringYourTurnOnly && source.owner !== state.activePlayer) continue;
      if (ability.boardCondition && !isBoardConditionMet(state, source.owner, ability.boardCondition, source.instanceId)) continue;
      const includesTarget = matchesStaticScope(source, target, ability.scope);
      if (includesTarget && ability.targetCondition && !isTargetConditionMet(target, state, ability.targetCondition)) continue;
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
/**
 * GD01-090 Duo Maxwell (Lote 5) — "This Unit's AP can't be reduced by enemy effects.",
 * gate "During Link". Procura `innateStatReductionImmunity` tanto na própria carta
 * quanto no Pilot pareado (mesma convenção de `findInnateDamageProtection`, combat.ts).
 */
function hasStatReductionImmunity(card: CardInstance, stat: StatKey, state: GameState): boolean {
  const pilot = card.pairedPilotId ? findInBattleArea(state, card.owner, card.pairedPilotId) : undefined;
  const isLink = !!pilot && satisfiesLinkCondition(effectivePilotDef(pilot), card.def);

  const ownImmunity = card.def.innateStatReductionImmunity;
  if (ownImmunity && ownImmunity.stat === stat && (!ownImmunity.duringLinkOnly || isLink)) return true;

  const pilotImmunity = pilot?.def.innateStatReductionImmunity;
  if (pilotImmunity && pilotImmunity.stat === stat && (!pilotImmunity.duringLinkOnly || isLink)) return true;

  return false;
}

/** Filtra `statModifiers` pro cálculo de `effectiveAp`/`effectiveHp`: some reduções (amount < 0) de origem INIMIGA quando a Unit tem imunidade ativa pra esse stat. */
function applicableStatModifiers(card: CardInstance, stat: StatKey, state?: GameState): StatModifier[] {
  const immune = state ? hasStatReductionImmunity(card, stat, state) : false;
  return card.statModifiers.filter((m) => {
    if (m.stat !== stat) return false;
    if (immune && m.amount < 0 && m.appliedBy && m.appliedBy !== card.owner) return false;
    return true;
  });
}

export function effectiveAp(card: CardInstance, state?: GameState, pairedPilot?: CardInstance | null): number {
  const base = card.def.ap ?? 0;
  const bonus = applicableStatModifiers(card, "ap", state).reduce((sum, m) => sum + m.amount, 0);
  const staticBonus = state ? computeStaticStatBonus(card, state, "ap") : 0;
  const pilotBonus = resolvePilotStatBonus(card, "ap", state, pairedPilot);
  return Math.max(0, base + bonus + staticBonus + pilotBonus);
}

export function effectiveHp(card: CardInstance, state?: GameState, pairedPilot?: CardInstance | null): number {
  const base = card.def.hp ?? 0;
  const bonus = applicableStatModifiers(card, "hp", state).reduce((sum, m) => sum + m.amount, 0);
  const staticBonus = state ? computeStaticStatBonus(card, state, "hp") : 0;
  const pilotBonus = resolvePilotStatBonus(card, "hp", state, pairedPilot);
  return Math.max(0, base + bonus + staticBonus + pilotBonus);
}

/**
 * Custo efetivo de deploy/jogada de `def` (Lote 5) — aplica `def.dynamicCost`
 * se a condição de board estiver satisfeita agora. `state` opcional, mesmo
 * espírito de `effectiveAp`/`effectiveHp`: sem ele, o desconto não é visto
 * (fallback pro custo impresso).
 */
export function effectiveCost(def: CardDef, state?: GameState, controller?: PlayerId): number {
  const base = def.cost ?? 0;
  if (!def.dynamicCost || !state || !controller) return base;
  const met = isBoardConditionMet(state, controller, def.dynamicCost.condition);
  if (!met) return base;
  if (def.dynamicCost.perEnemyUnit) {
    const enemyCount = state.players[otherPlayer(controller)].battleArea.filter((c) => c.def.cardType === "UNIT").length;
    return Math.max(0, base + def.dynamicCost.amount * enemyCount);
  }
  return Math.max(0, base + def.dynamicCost.amount);
}

/**
 * Nível efetivo de deploy de `def` — aplica `def.dynamicLevel` se a condição
 * estiver satisfeita (ex.: ST08-001 Xi Gundam).
 */
export function effectiveLevel(def: CardDef, state?: GameState, controller?: PlayerId): number {
  const base = def.level ?? 0;
  if (!def.dynamicLevel || !state || !controller) return base;
  const met = isBoardConditionMet(state, controller, def.dynamicLevel.condition);
  if (!met) return base;
  if (def.dynamicLevel.perEnemyUnit) {
    const enemyCount = state.players[otherPlayer(controller)].battleArea.filter((c) => c.def.cardType === "UNIT").length;
    return Math.max(0, base + def.dynamicLevel.amount * enemyCount);
  }
  return Math.max(0, base + def.dynamicLevel.amount);
}

/** Acha a 1ª `StaticAbility.keyword` ativa de alguma fonte na Battle Area de `card` que concede `keyword` (Lote 3) — mesmas regras de gate de `computeStaticStatBonus`; base pra `hasKeyword`/`keywordValue`. */
function findActiveStaticKeywordAbility(card: CardInstance, keyword: string, state: GameState): StaticAbility | undefined {
  const owner = state.players[card.owner];
  for (const source of owner.battleArea) {
    for (const ability of source.def.staticAbilities ?? []) {
      if (ability.keyword !== keyword) continue;
      if (!isStaticAbilityActive(state, source, ability.condition)) continue;
      if (ability.duringYourTurnOnly && source.owner !== state.activePlayer) continue;
      if (ability.boardCondition && !isBoardConditionMet(state, source.owner, ability.boardCondition, source.instanceId)) continue;
      if (!matchesStaticScope(source, card, ability.scope)) continue;
      if (ability.targetCondition && !isTargetConditionMet(card, state, ability.targetCondition)) continue;
      return ability;
    }
  }
  return undefined;
}

/**
 * `state` é opcional só pra não quebrar callers que ainda não têm acesso a
 * ele — sem `state`, keywords concedidas por `StaticAbility` (Lote 3, ex.
 * 【During Pair】/condição de board/aura de Pilot) não são vistas, mesmo
 * limite documentado em `effectiveAp` acima.
 */
export function hasKeyword(card: CardInstance, keyword: string, state?: GameState): boolean {
  const fromDef = card.def.effectKeywords?.includes(keyword) ?? false;
  const fromGrant = card.keywordGrants.some((g) => g.keyword === keyword);
  const fromStatic = state ? findActiveStaticKeywordAbility(card, keyword, state) !== undefined : false;
  return fromDef || fromGrant || fromStatic;
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
export function keywordValue(card: CardInstance, keyword: string, state?: GameState): number | null {
  const grant = card.keywordGrants.find((g) => g.keyword.toLowerCase().startsWith(keyword.toLowerCase()));
  if (grant) {
    const match = grant.keyword.match(/(-?\d+)/);
    return match ? Number(match[1]) : 0;
  }
  const tag = card.def.keywordTags?.find((t) => t.toLowerCase().startsWith(keyword.toLowerCase()));
  if (tag) {
    const match = tag.match(/(-?\d+)/);
    return match ? Number(match[1]) : 0;
  }
  const staticAbility = state ? findActiveStaticKeywordAbility(card, keyword, state) : undefined;
  if (staticAbility) return staticAbility.keywordValue ?? 0;
  return hasKeyword(card, keyword, state) ? 0 : null;
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
 * batalha, Breach letal, combatTrigger letal). `wasPaired`/`wasLinkUnit`/
 * `formerPairedPilotId` são capturados ANTES do `DESTROY_CARD` (a Unit perde
 * `pairedPilotId` ao ir pro trash) — habilita o gate 【During Pair】【Destroyed】
 * (ST04-009 Miguel's Ginn) e, respectivamente, 【During Link】【Destroyed】 +
 * "Return this Unit's paired Pilot..." (GD01-005 Unicorn Gundam) — Lote 5
 * (docs/debates 2026-09-13). `formerPairedPilotId` é o instanceId do Pilot que
 * estava pareado no momento da destruição (pode já ter ido pro trash também,
 * via `pairedPilotFollowEvents`/CR 3-3-6 — o efeito ainda encontra a carta por
 * instanceId em qualquer zona).
 */
export interface DestroyedInBattle {
  instanceId: string;
  owner: PlayerId;
  wasPaired: boolean;
  wasLinkUnit?: boolean;
  formerPairedPilotId?: string;
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
        targetScope: "enemyUnit" | "ownResource" | "friendlyUnit" | "anyUnit";
        /** instanceIds já legais AGORA pra este alvo (escopo + `targetFilter` aplicados) — `[]` = nenhum alvo legal, o efeito não ativa. */
        legalTargets: string[];
        /** Lote 4 (docs/debates 2026-09-13) — presente só quando `EffectSpec.targetCount` existe ("Choose 1 to 2"/"Choose 2 ..."); ausente = escolha singular de sempre. `resolveAbility` valida `resolution.targetIds.length <= max` contra isto. */
        targetCount?: { min: number; max: number };
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
        /**
         * ST04-002 Strike Gundam 【Deploy】 "Draw 1. Then, discard 1." — o jogador
         * escolhe `n` cartas da mão pra descartar. `legalHandIds` inclui as
         * cartas que serão compradas antes do descarte (dá pra descartar a
         * recém-comprada). A escolha viaja em `resolution.targetIds` e vira
         * `ctx.targets.discard`. `discardNamed` no `effectSpec`.
         */
        handDiscard?: { n: number; legalHandIds: string[]; label: string };
        /**
         * ST02-015 Saint Gabriel 【Deploy】 "look at the top 2 cards of your deck
         * and return 1 to the top and 1 to the bottom" — o jogador atribui cada
         * carta do topo a `slots[i].name` (o `name` do `moveWithinDeck` nomeado).
         * `resolution.targetIds[i]` → `slots[i]`. `topCards` é o topo do deck
         * (redigido a `[]` pro oponente pela `viewState`, igual `deckTopReveal`).
         */
        deckReorder?: { topCards: CardInstance[]; slots: Array<{ name: string; position: "top" | "bottom" }>; label: string };
        /**
         * ST04-012 Striker Pack 【Main】 "deploy 1 [Sword Strike] or 1 [Launcher
         * Strike] Unit token" — escolha ENUM. `resolution.targetIds` = `[value]`
         * de uma das `options`; vira `ctx.targets[key]`. `spawnTokenChoice` no
         * `effectSpec`.
         */
        enumChoice?: { key: string; options: Array<{ value: string; label: string }>; label: string };
        /**
         * Lote 5 (docs/debates 2026-09-13) — GD01-067 "Choose 1 Command card that
         * is Lv.5 or lower from your trash. Add it to your hand." Busca na
         * LIXEIRA (zona sempre visível, sem "topo N" — diferente de `deckTopReveal`).
         * `legalTrashIds` já filtrado por `CardDefFilter`; `resolveAbility` valida
         * contra ele. A escolha viaja em `resolution.targetIds` (0 ou 1 id) e vira
         * `ctx.targets.trashSearch` (ou o `name` custom do `searchTrashToHand`).
         */
        trashSearch?: { legalTrashIds: string[]; label: string };
        /**
         * Lote 5 (docs/debates 2026-09-13) — GD01-005: alvo(s) IMPLÍCITO(S), calculados
         * pelo motor (não escolhidos pelo jogador), ex. `{ formerPairedPilot: [instanceId] }`
         * — o Pilot que estava pareado com a Unit destruída ANTES do `DESTROY_CARD`
         * (ver `DestroyedInBattle.formerPairedPilotId`). Mesclado em `ctx.targets` na
         * hora de resolver (`resolveAbility`), junto com a escolha real do jogador.
         */
        implicitTargets?: Record<string, string[]>;
        /**
         * docs/47 Fase 5 — 2º alvo nomeado no caminho de FILA (gatilho automático
         * pausado, ex. ST05-010 Mikazuki Augus 【When Paired】"Choose 1 of your
         * Units and 1 enemy Unit"), espelhando `EffectSpec.secondaryTarget`
         * (que até aqui só era resolvido no caminho de Command 【Main】/【Action】,
         * que já vem com `action.targets` prontos — não passa pela fila). Campo
         * IRMÃO de `legalTargets`/`targetScope` (que continuam sendo o POOL
         * PRIMÁRIO) — nunca reaproveitado entre specs, mesma convenção dos
         * demais campos de escolha aqui. A escolha viaja em
         * `resolution.secondaryTargetIds` e vira `ctx.targets[name]`.
         */
        secondaryTarget?: { name: string; targetScope: "enemyUnit" | "ownResource" | "friendlyUnit" | "anyUnit"; legalTargets: string[] };
        /**
         * docs/47 Fase 6 — presente só quando esta entrada da fila NÃO vem de um
         * `EffectSpec` (não tem `specId` real pra `dispatchTrigger`), mas de um
         * `PendingCombatTriggerChoice` (`CombatTrigger.action` bruto, ver types.ts).
         * `resolveAbility` (actions.ts) resolve isto compilando `action` direto
         * (`DAMAGE_UNIT`/`DESTROY_CARD`/`pairedPilotFollowEvents` pra
         * `damageChosenEnemyUnit`; `MOVE_CARD` pra `hand` pra `retrieveFromTrash`),
         * em vez de despachar um spec. `specId` da entrada é sintético
         * (`${sourceInstanceId}-combatTrigger-${on}`), só pra casar com
         * `resolution.specId` — nunca existe em `specs`.
         */
        combatTrigger?: PendingCombatTriggerChoice;
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
  unitDamageProtection?: { instanceId: string; maxAttackerAp?: number; maxAttackerLevel?: number } | null;
  /** docs/47 Fase 6 — ver `PendingCombatTriggerChoice`. Populado por `resolveDamageStep`, consumido e limpo por `actions.ts` ao montar a pausa. */
  pendingTriggerChoices?: PendingCombatTriggerChoice[];
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
  /** `null` só pro empate determinístico do guard anti-loop (`reason: "trigger_loop_guard"`) — todo outro motivo sempre tem um vencedor. */
  winner: PlayerId | null;
  /**
   * "abandonment" e "resignation" nunca são produzidas pelo motor puro — só
   * existem porque o servidor (matchStore.ts, passo 4 do docs/18) precisa
   * encerrar uma partida por um motivo que não é regra de jogo: "resignation"
   * = o jogador clicou "Desistir"; "abandonment" = W.O. por inatividade
   * (botão do oponente ou auto-forfeit AFK). Mantidas aqui, não num tipo à
   * parte no servidor, porque `GameOverInfo` já é o único formato de "fim de
   * jogo" que `ViewGameState`/a UI conhecem — criar um 2º formato só pra isso
   * duplicaria a renderização de fim de jogo no cliente sem necessidade.
   *
   * "trigger_loop_guard" — guarda anti-loop-infinito de despacho de gatilhos
   * (MAX_CASCADE_DEPTH/MAX_QUEUE_BREADTH, ver abilityDispatch.ts) estourou em
   * partida real: empate forçado, mesma resolução que TCGs físicos usam pra
   * loop determinístico sem progresso.
   */
  reason: "deckOut" | "noShieldsBattleDamage" | "abandonment" | "resignation" | "trigger_loop_guard";
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
  /**
   * Versão do motor (git sha curto) no momento em que a partida foi criada —
   * `"dev"` fora do build de produção. A triagem de bug report (docs/44 §8.4)
   * checa isto primeiro: um report gerado por um motor antigo pode já estar
   * corrigido. Opcional pra não quebrar estados serializados antes deste campo.
   */
  engineVersion?: string;
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
  /**
   * Lote 5 (docs/debates 2026-09-13) — GD01-003 "Choose 12 cards from your trash. Return
   * them to their owner's deck and shuffle it." Move os `instanceIds` dados (já na lixeira
   * do PRÓPRIO `player`) pro deck e re-embaralha com `createRng(seed ^ eventLog.length)`
   * (mesmo espírito do nonce de `redrawMulliganHand`/`mulliganNonce`, mas variando por
   * EVENTO em vez de por jogador — esta carta pode ser usada mais de 1 vez no jogo).
   */
  | { type: "RETURN_TRASH_TO_DECK_SHUFFLE"; player: PlayerId; instanceIds: string[] }
  /** ST02-013 Peaceful Timbre — ver `CombatState.shieldProtection`. Não-op se não houver combate em andamento. */
  | { type: "SET_SHIELD_PROTECTION"; maxAttackerLevel: number }
  /** ST03-014 The Blue Giant — ver `CombatState.unitDamageProtection`. Não-op fora de combate. */
  | { type: "SET_UNIT_DAMAGE_PROTECTION"; instanceId: string; maxAttackerAp?: number; maxAttackerLevel?: number }
  /** ST04-011 Athrun Zala — ver `CardInstance.attackTargetRelaxUntilTurn`. */
  | { type: "GRANT_ATTACK_TARGET_RELAX"; instanceId: string; maxLevel?: number; maxAp?: number; turn: number }
  /** ST04-015 Archangel — ver `CardInstance.cannotAttackUntilTurn`. */
  | { type: "SET_CANNOT_ATTACK"; instanceId: string; turn: number }
  /** ST08-009 Jegan Ground Type-A — ver `CardInstance.cannotActivateUntilTurn`. */
  | { type: "SET_CANNOT_ACTIVATE"; instanceId: string; turn: number }
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
  | { type: "GAME_OVER"; winner: PlayerId | null; reason: GameOverInfo["reason"] };

/**
 * Comprehensive Rules 3-3-6: Pilot pareado segue a Unit pro mesmo destino
 * (trash) quando ela é destruída — POR QUALQUER MOTIVO, não só combate.
 * Movida de `combat.ts` (era local/não-exportada, só usada ali) pra cá e
 * exportada: `compilePrimitive` (`effectSpec.ts`, `destroy`/`damageUnit`)
 * também precisa dela — Unit pareada morta por EFEITO fora de combate não
 * levava o Pilot junto, gap transversal fechado na revalidação (docs/47).
 */
export function pairedPilotFollowEvents(unit: CardInstance): GameEvent[] {
  if (!unit.pairedPilotId) return [];
  return [{ type: "DESTROY_CARD", instanceId: unit.pairedPilotId }];
}
