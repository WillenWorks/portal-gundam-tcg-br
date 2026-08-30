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

/** As 8 zonas oficiais (ver docs/18, "Modelo de zonas"). */
export type Zone =
  | "deck"
  | "resourceDeck"
  | "shields"
  | "resourceArea"
  | "battleArea"
  | "baseSection"
  | "trash"
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
  ap?: number;
  hp?: number;
  traits?: string[];
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
  statModifiers: StatModifier[];
  keywordGrants: KeywordGrant[];
  /** nomes de keyword [Once per Turn] já usados nesta instância, neste turno */
  usedKeywordsThisTurn: string[];
  /** turno em que entrou na zona atual — usado por regras tipo "Link ataca imediato ao ser deployada" */
  enteredZoneOnTurn: number;
}

/**
 * Comprehensive Rules 3-2-6: a Unit vira "Link Unit" quando o Pilot pareado
 * satisfaz a link condition dela. Não tem efeito em pareamento (isso é livre,
 * 3-3-1/3-3-4) — só decide se a Unit ganha a exceção de atacar no turno em
 * que foi deployada (3-2-6-3, ver `combat.ts`/`declareAttack`).
 */
export function satisfiesLinkCondition(pilotDef: CardDef, unitDef: CardDef): boolean {
  const link = unitDef.link;
  if (!link) return false;
  if (link.kind === "pilotName") {
    return link.values.some((name) => pilotDef.nameEn.includes(name));
  }
  return link.values.some((trait) => (pilotDef.traits ?? []).includes(trait));
}

export function effectiveAp(card: CardInstance): number {
  const base = card.def.ap ?? 0;
  const bonus = card.statModifiers
    .filter((m) => m.stat === "ap")
    .reduce((sum, m) => sum + m.amount, 0);
  return Math.max(0, base + bonus);
}

export function effectiveHp(card: CardInstance): number {
  const base = card.def.hp ?? 0;
  const bonus = card.statModifiers
    .filter((m) => m.stat === "hp")
    .reduce((sum, m) => sum + m.amount, 0);
  return Math.max(0, base + bonus);
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
  hand: CardInstance[];
}

export interface GameOverInfo {
  winner: PlayerId;
  /**
   * "abandonment" nunca é produzida pelo motor puro — só existe porque o
   * servidor (matchStore.ts, passo 4 do docs/18) precisa encerrar uma
   * partida por um motivo que não é regra de jogo (W.O. por 3min sem
   * atividade do oponente). Mantida aqui, não num tipo à parte no servidor,
   * porque `GameOverInfo` já é o único formato de "fim de jogo" que
   * `ViewGameState`/a UI conhecem — criar um 2º formato só pra isso
   * duplicaria a renderização de fim de jogo no cliente sem necessidade.
   */
  reason: "deckOut" | "noShieldsBattleDamage" | "abandonment";
}

export interface GameState {
  turnNumber: number;
  activePlayer: PlayerId;
  phase: Phase;
  combat: CombatState | null;
  players: Record<PlayerId, PlayerState>;
  eventLog: GameEvent[];
  gameOver: GameOverInfo | null;
  /** contador monotônico usado pra gerar instanceId determinístico (facilita teste) */
  nextInstanceSeq: number;
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
  | { type: "DAMAGE_SHIELD"; player: PlayerId; count: number }
  | { type: "DAMAGE_BASE"; instanceId: string; amount: number }
  | { type: "MODIFY_STAT"; instanceId: string; modifier: StatModifier }
  | { type: "GRANT_KEYWORD"; instanceId: string; grant: KeywordGrant }
  | { type: "CLEAR_TURN_MODIFIERS"; turnNumber: number }
  | { type: "MARK_KEYWORD_USED"; instanceId: string; keyword: string }
  | { type: "DISCARD_TO_HAND_LIMIT"; player: PlayerId; instanceIds: string[] }
  | { type: "PAIR_CARDS"; pilotId: string; unitId: string }
  | { type: "ATTACK_DECLARED"; attackerId: string; attackingPlayer: PlayerId; defendingPlayer: PlayerId; target: AttackTarget }
  | { type: "BLOCK_DECLARED"; blockerId: string; newTarget: AttackTarget }
  | { type: "ACTION_PASS"; player: PlayerId }
  | { type: "COMBAT_STEP_CHANGE"; step: CombatStep }
  | { type: "COMBAT_ENDED" }
  | { type: "GAME_OVER"; winner: PlayerId; reason: GameOverInfo["reason"] };
