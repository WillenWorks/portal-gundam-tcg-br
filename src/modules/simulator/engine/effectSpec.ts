import type { CardDef, CardInstance, Duration, GameEvent, GameState, PlayerId, StatKey, Zone } from "./types";
import { effectiveCost, effectiveHp, effectivePilotDef, hasKeyword, otherPlayer, pairedPilotFollowEvents, satisfiesLinkCondition } from "./types";
import { findCard, findCardOwner } from "./events";
import { payResourceCostEvents } from "./costs";
import { TOKEN_EX_RESOURCE_CODE } from "./setup";
import { selfHealReactionEvents } from "./keywords";

/**
 * "Effect Spec" — formalização da Camada 3 (texto livre → lógica) proposta
 * em docs/18: uma estrutura declarativa intermediária entre o `effectEn`
 * bruto do `CardModel` e os eventos executáveis do motor, em vez de pular
 * direto pra uma closure JS opaca.
 *
 * Por que isso importa: dá pra revisar um `EffectSpec` lado a lado com o
 * texto oficial da carta (mesma lógica de "validável e confiável" já usada
 * no motor de estatísticas), e dá um checkpoint natural de cobertura por
 * carta/por wave (ex.: "174 cartas de ST01-04+GD01 precisam de EffectSpec,
 * X já têm"). Autoria carta a carta é trabalho da Fase 1, passo 3
 * ("Escolher 1 deck de teste") — este arquivo só define a forma, ainda não
 * tem nenhum `EffectSpec` de carta real.
 *
 * Toda keyword oficial (Blocker, First Strike, Support, Repair, Breach,
 * Suppression, High-Maneuver, Once per Turn) já é tratada automaticamente
 * pelo motor (combat.ts / keywords.ts) — não precisa de EffectSpec. Isso
 * fica só pro texto bespoke dentro de `textSectionsJson[].text`.
 */

export type PlayerRef = PlayerId | "controller" | "opponent";

export function resolvePlayerRef(ref: PlayerRef, controller: PlayerId): PlayerId {
  if (ref === "controller") return controller;
  if (ref === "opponent") return otherPlayer(controller);
  return ref;
}

export type TargetRef =
  | { kind: "self" }
  /** a Unit pareada com a fonte — se a fonte JÁ é Unit, é ela mesma; se é Pilot,
   *  é `pairedUnitId`. Usado por efeito de Pilot cujo texto diz "this Unit"
   *  (ex. ST03-011 Char Aznable 【Attack】). Lança se a fonte é Pilot sem par. */
  | { kind: "pairedUnit" }
  | { kind: "instance"; instanceId: string }
  /** grupo de alvo nomeado, resolvido antes pelo seletor de UI/IA e colocado em EffectContext.targets — sempre usa só group[0], mesmo que o array tenha mais de 1 entrada (ver docs/18, escopo do seletor de UI). */
  | { kind: "named"; name: string }
  /**
   * Lote 4 (docs/debates 2026-09-13) — "Choose 1 to 2 ..."/"Choose 2 ..." (GD01-044/112/114):
   * mesma escolha externa de "named" (o jogador/IA escolhe QUAIS candidatos do pool
   * de `targetScope`/`targetFilter`), mas consome o array INTEIRO de
   * `ctx.targets[name]` (0..`EffectSpec.targetCount.max`), não só `group[0]`.
   * Ver `EffectSpec.targetCount` pra cardinalidade.
   */
  | { kind: "namedGroup"; name: string }
  /** grupo de alvo COLETIVO, computado dinamicamente a partir de `ctx.state` — não precisa de escolha externa, porque o próprio padrão já define quem entra (ex.: "toda Unit amiga com Link ativo agora"). Ver docs/18, lacuna #5. */
  | { kind: "group"; group: TargetGroup };

/**
 * Padrões de alvo em grupo hoje usados por cartas reais: ST01-016 Asticassia
 * ("All friendly Link Units") e ST02-003 Gundam Heavyarms ("all enemy Units
 * that are Lv.3 or lower"). Novo padrão = novo membro desta union, não uma
 * reescrita do desenho — mesma filosofia dos outros campos estruturados do
 * DSL (`link`, `staticAbilities`).
 */
export type TargetGroup =
  | { kind: "allFriendlyLinkUnits" }
  /** GD02-107 All-Range Attack — "Deal 1 damage to all enemy Units other than Link Units". */
  | { kind: "allEnemyUnits"; maxLevel?: number; excludeLinkUnits?: boolean }
  /** GD01-102 The Path to Victory or Defeat / ST07-009 Setsuna — "All friendly Units [with trait] ..." */
  | { kind: "allFriendlyUnits"; maxLevel?: number; trait?: string }
  /**
   * GD01-024 Wing Gundam Zero ("Deal 3 damage to all Units that are Lv.5 or
   * lower"), GD01-027 Big Zam / GD01-108 Strategic Arms ("all Units with
   * <Blocker>") — texto oficial "all Units" (sem "enemy"/"friendly") atinge
   * AMBOS os lados do tabuleiro. `hasKeyword` filtra por keyword própria OU
   * concedida (mesma checagem de `defaultTargetFilterResolver`).
   */
  | { kind: "allUnits"; maxLevel?: number; hasKeyword?: string }
  /**
   * ST08-006 Penelope — "reveal 1 (Earth Federation) Unit card from your hand.
   * Return to the bottom of your deck." Não existe `targetScope` pra mão ainda
   * (só battleArea/baseSection via enemyUnit/friendlyUnit/anyUnit/ownResource),
   * então isto resolve automaticamente pra 1ª Unit da mão do controller que
   * casa o trait — sem escolha interativa, mesma simplificação documentada de
   * `returnTrashToDeckAndShuffle` (GD01-003). Resolve pra `[]` (no-op) se não
   * houver carta assim — o "if you do" da carta é modelado pelo `condition`
   * (predicate `controllerHandHasUnitWithTrait:<trait>`), não por esta função.
   */
  | { kind: "firstOwnHandUnitWithTrait"; trait: string }
  /**
   * GD02-111 Decisive Last Resort — "Choose 6 purple Unit cards from your trash. Exile them
   * from the game." Mesma simplificação documentada de `returnTrashToDeckAndShuffle` (GD01-003):
   * saem do jogo pra sempre, a identidade específica das 6 não muda o resultado, então resolve
   * pras primeiras `count` cartas da lixeira que casam o filtro — sem escolha interativa. O
   * "if you do" (só exilar se houver 6+ elegíveis) é modelado pelo `condition` do spec
   * (`controllerTrashUnitColorCountAtLeast`), não aqui.
   */
  | { kind: "firstNInTrash"; count: number; filter: CardDefFilter };

function isLinkUnit(state: GameState, unit: CardInstance): boolean {
  if (!unit.pairedPilotId) return false;
  const pilot = findCard(state, unit.pairedPilotId);
  return satisfiesLinkCondition(effectivePilotDef(pilot), unit.def);
}

function resolveTargetGroup(group: TargetGroup, ctx: EffectContext): string[] {
  if (group.kind === "allFriendlyLinkUnits") {
    const owner = ctx.state.players[ctx.controller];
    return owner.battleArea.filter((u) => u.def.cardType === "UNIT" && isLinkUnit(ctx.state, u)).map((u) => u.instanceId);
  }
  if (group.kind === "allFriendlyUnits") {
    const owner = ctx.state.players[ctx.controller];
    return owner.battleArea
      .filter(
        (u) =>
          u.def.cardType === "UNIT" &&
          (group.maxLevel === undefined || (u.def.level ?? 0) <= group.maxLevel) &&
          (!group.trait || (u.def.traits ?? []).includes(group.trait)),
      )
      .map((u) => u.instanceId);
  }
  if (group.kind === "allUnits") {
    const bothSides = [...ctx.state.players.A.battleArea, ...ctx.state.players.B.battleArea];
    return bothSides
      .filter((u) => u.def.cardType === "UNIT")
      .filter((u) => group.maxLevel === undefined || (u.def.level ?? 0) <= group.maxLevel)
      .filter((u) => !group.hasKeyword || hasKeyword(u, group.hasKeyword, ctx.state))
      .map((u) => u.instanceId);
  }
  if (group.kind === "firstOwnHandUnitWithTrait") {
    const owner = ctx.state.players[ctx.controller];
    const match = owner.hand.find((c) => c.def.cardType === "UNIT" && (c.def.traits ?? []).includes(group.trait));
    return match ? [match.instanceId] : [];
  }
  if (group.kind === "firstNInTrash") {
    const owner = ctx.state.players[ctx.controller];
    return owner.trash
      .filter((c) => matchesCardDefFilter(c.def, group.filter))
      .slice(0, group.count)
      .map((c) => c.instanceId);
  }
  const opponent = ctx.state.players[otherPlayer(ctx.controller)];
  return opponent.battleArea
    .filter((u) => u.def.cardType === "UNIT" && (group.maxLevel === undefined || (u.def.level ?? 0) <= group.maxLevel))
    .filter((u) => !group.excludeLinkUnits || !isLinkUnit(ctx.state, u))
    .map((u) => u.instanceId);
}

/** Resolve pra exatamente 1 instanceId — usado por quem sabe que o alvo é sempre singular ("self", "pairedUnit", "instance", "named"). */
function resolveTarget(ref: Exclude<TargetRef, { kind: "group" } | { kind: "namedGroup" }>, ctx: EffectContext): string {
  switch (ref.kind) {
    case "self":
      return ctx.sourceInstanceId;
    case "pairedUnit": {
      const source = findCard(ctx.state, ctx.sourceInstanceId);
      if (source.def.cardType === "UNIT") return ctx.sourceInstanceId;
      if (source.pairedUnitId) return source.pairedUnitId;
      throw new Error("Alvo \"pairedUnit\": a fonte não é Unit e não tem Unit pareada");
    }
    case "instance":
      return ref.instanceId;
    case "named": {
      const group = ctx.targets[ref.name];
      if (!group || group.length === 0) {
        throw new Error(`Alvo nomeado "${ref.name}" não foi resolvido antes da execução do efeito`);
      }
      return group[0];
    }
  }
}

/** Resolve pra 0+ instanceIds — usado por toda primitiva que consome `TargetRef` (única fonte de verdade pra aplicar a mesma ação a um GRUPO inteiro de alvos, não só a 1). */
function resolveTargetIds(ref: TargetRef, ctx: EffectContext): string[] {
  if (ref.kind === "group") return resolveTargetGroup(ref.group, ctx);
  // Lote 4 — "namedGroup" consome TODO o array escolhido (0..max), nunca lança:
  // 0 escolhidos é uma escolha legal ("Choose 1 to 2 ..." com o jogador optando por menos).
  if (ref.kind === "namedGroup") return ctx.targets[ref.name] ?? [];
  return [resolveTarget(ref, ctx)];
}

/**
 * GD02-064 Gundam Leopard — "During your turn, while there are 7 or more cards in your
 * trash, this Unit can't receive effect damage from enemy Commands." Diferente da proteção
 * de dano de BATALHA (`combat.ts`) — esta é checada no PRÓPRIO `damageUnit`, único caminho de
 * dano de efeito no motor. A fonte do dano (`ctx.sourceInstanceId`) precisa existir e ser
 * INIMIGA do dono do alvo pra contar como "enemy Commands".
 */
function isProtectedFromEffectDamage(target: CardInstance, ctx: EffectContext): boolean {
  const prot = target.def.innateEffectDamageProtection;
  if (!prot) return false;
  if (!ctx.sourceInstanceId) return false;
  const source = findCard(ctx.state, ctx.sourceInstanceId);
  if (source.owner === target.owner) return false; // só protege de fonte INIMIGA
  if (source.def.cardType !== prot.fromCardType) return false;
  if (prot.duringYourTurnOnly && target.owner !== ctx.state.activePlayer) return false;
  if (prot.requiresTrashCountAtLeast !== undefined && ctx.state.players[target.owner].trash.length < prot.requiresTrashCountAtLeast) return false;
  return true;
}

export type PrimitiveCall =
  | { op: "draw"; player: PlayerRef; n: number }
  | { op: "discard"; player: PlayerRef; instanceIds: string[] }
  /** "discard N" onde a(s) carta(s) são escolha do jogador — lê `ctx.targets[name]`
   *  (mesmo padrão de alvo nomeado). Ex.: ST04-002 Strike Gundam "Draw 1. Then,
   *  discard 1." No-op se nada foi escolhido (o dispatcher pausa pra escolha).
   *  Lote 5 (docs/debates 2026-09-13) — GD01-023 "Discard 1 (Zeon)/(Neo Zeon)
   *  Unit card" (CUSTO, não ação): `filter?` restringe a escolha por CardDefFilter
   *  (ausente = qualquer carta da mão, comportamento de antes). Validado de novo
   *  em `compilePrimitive` (defesa em profundidade, mesmo padrão de `searchTrashToHand`). */
  | { op: "discardNamed"; player: PlayerRef; name: string; n: number; filter?: CardDefFilter }
  | { op: "damageShield"; player: PlayerRef; count: number }
  | { op: "destroy"; target: TargetRef }
  | { op: "moveZone"; target: TargetRef; toZone: Zone }
  | { op: "modifyStat"; target: TargetRef; stat: StatKey; amount: number; duration: Duration }
  | { op: "grantKeyword"; target: TargetRef; keyword: string; duration: Duration }
  | { op: "rest"; target: TargetRef }
  | { op: "setActive"; target: TargetRef }
  | { op: "heal"; target: TargetRef; amount: number }
  /** dano direto numa Unit/Base (ex.: "Deal 1 damage to it") — destrói automaticamente se o dano acumulado bater o HP efetivo (Comprehensive Rules 5-5-2), igual à checagem já feita em combat.ts pro dano de batalha */
  | { op: "damageUnit"; target: TargetRef; amount: number }
  /**
   * GD02-011 Moebius — "Choose 1 enemy Base/enemy Shield this Unit is battling. Deal 6
   * damage to it." Alvo sempre vem de `targetScope: "battlingBaseOrShield"`, que só
   * inclui Base/Shield de verdade — o handler decide a REGRA pela zona atual do alvo
   * resolvido: Base acumula dano normal (igual `damageUnit`, `DAMAGE_UNIT`/`DAMAGE_BASE`
   * são o MESMO evento na prática — ver `events.ts`); Shield tem "1 HP" (Comprehensive
   * Rules — qualquer dano destrói inteiro, mesma regra de `shieldDamageEvents`/
   * `breachEvents`), então destrói direto, sem acumular/checar `effectiveHp`.
   */
  | { op: "damageBattlingBaseOrShield"; target: TargetRef; amount: number }
  /** custo de recurso genérico (docs/18, lacuna #4) — resta N Recursos active do controller (ou os instanceIds dados), EX Resource sai do jogo (mesma regra de deploy.ts/costs.ts). Ex.: ST02-006 Tallgeese "④", ST01-015 White Base "②". */
  | { op: "payResourceCost"; player: PlayerRef; n: number; resourceInstanceIds?: string[] }
  /** cria 1+ instância nova a partir de um CardDef (docs/18, lacuna #3 — "criar instância nova"). Ex.: ST02-002 Wing Gundam (Bird Mode) "Place 1 EX Resource". */
  | { op: "spawnToken"; def: CardDef; player: PlayerRef; zone: Zone; count?: number; rested?: boolean }
  /** variante de spawnToken que escolhe QUAL CardDef instanciar contando as próprias Units em campo (ex.: ST01-015 White Base — Gundam/Guncannon/Guntank token conforme 0/1/2+ Units já em jogo). `thresholds` é avaliado em ordem crescente de `maxUnits`; o 1º cuja contagem atual seja <= maxUnits vence. */
  | { op: "spawnTokenByOwnUnitCount"; player: PlayerRef; zone: Zone; thresholds: { maxUnits: number; def: CardDef }[] }
  /** reordena 1 carta já revelada (via peekAndReorderDeck) de volta pro topo ou pro fundo do próprio deck, sem trocar de zona. Ex.: ST02-015 Saint Gabriel Institute. Com `target.kind: "named"` é interativo (camada de decisão, `deckReorder`). */
  | { op: "moveWithinDeck"; target: TargetRef; position: "top" | "bottom" }
  /**
   * Lote 5 (docs/debates 2026-09-13) — GD01-003 "Choose 12 cards from your trash. Return
   * them to their owner's deck and shuffle it." Sem escolha real de QUAIS cartas quando a
   * lixeira tem mais de `count` (simplificação documentada, mesmo espírito do auto-alvo de
   * `CombatTrigger`): pega sempre as `count` primeiras da lixeira, determinístico. No-op se
   * a lixeira estiver vazia. O "if you do" da carta usa o predicate
   * `controllerTrashCountAtLeast:1` no `condition` (avaliado ANTES desta ação rodar).
   */
  | { op: "returnTrashToDeckAndShuffle"; player: PlayerRef; count: number }
  /**
   * "deploy 1 [A] or 1 [B] Unit token" — o jogador escolhe QUAL token invocar
   * (ex. ST04-012 Striker Pack 【Main】: Sword Strike ou Launcher Strike). A
   * escolha vem em `ctx.targets[key]` (0 ou 1 valor de `options[].value`),
   * resolvida pela camada de decisão (`enumChoice`). Sem escolha → `options[0]`
   * (default defensivo — a camada de decisão sempre força a escolha). */
  | { op: "spawnTokenChoice"; player: PlayerRef; zone: Zone; key: string; options: { value: string; label: string; def: CardDef }[] }
  /**
   * "Add N of your Shields to your hand" — o 【Deploy】 que TODA Base do jogo
   * tem (91/91 no dataset oficial, sem exceção; ver docs/18). Como shields
   * são face-down e o dono não vê a identidade (`viewState.ts`), a escolha de
   * "qual shield" não carrega informação nenhuma: usa `ctx.targets.shield` se
   * vier (permite a UI oferecer a escolha no futuro), senão pega os N
   * primeiros. **No-op se o jogador não tem shield — a Base ainda é
   * deployada normalmente** (o texto não é "may", mas "não dá pra fazer" =
   * pula).
   */
  | { op: "addShieldToHand"; player: PlayerRef; count: number }
  /** ST02-013 Peaceful Timbre — impede que shields recebam dano de Units inimigas até o level dado, durante esta batalha (docs/18, lacuna #7). Não-op fora de combate. */
  | { op: "preventShieldDamage"; maxAttackerLevel: number }
  /**
   * ST03-014 The Blue Giant 【Action】 — "Choose 1 friendly Unit. It can't receive
   * battle damage from enemy Units with 2 or less AP during this battle." Instala
   * `CombatState.unitDamageProtection` pra a Unit escolhida (`target` nomeado).
   * Não-op fora de combate. `maxAttackerAp` inclusivo.
   */
  /** GD02-105 Valedictorian — "can't receive battle damage from enemy Units during this battle" (SEM teto de AP/Level, protege de QUALQUER atacante). */
  | { op: "preventUnitBattleDamage"; target: TargetRef; maxAttackerAp?: number; maxAttackerLevel?: number; unconditional?: boolean }
  /**
   * ST04-011 Athrun Zala 【When Linked】 — "During this turn, this Unit may choose
   * an active enemy Unit that is Lv.5 or lower as its attack target." Instala
   * `CardInstance.attackTargetRelaxUntilTurn` na Unit alvo (normalmente
   * `{ kind: "pairedUnit" }` — "this Unit" no texto do Pilot), válido só no
   * turno atual. GD01-043/GD01-110 usam o mesmo relaxamento mas por AP, não
   * nível ("... com 4/6 ou menos AP") — `maxLevel`/`maxAp` são independentes,
   * quem autora passa só o que o texto oficial pede.
   */
  | { op: "grantAttackTargetRelax"; target: TargetRef; maxLevel?: number; maxAp?: number }
  /** GD02-040 Gundam Ashtaron 【Deploy】 — ver `CardInstance.battleDamageImmunityUntilTurn`. */
  | { op: "grantBattleDamageImmunityUntilTurn"; target: TargetRef; maxAttackerHp: number }
  /**
   * ST04-015 Archangel 【Activate･Main】 — "It can't attack during this turn."
   * Marca `CardInstance.cannotAttackUntilTurn = turno atual` na Unit alvo;
   * `declareAttack` barra enquanto for o mesmo turno.
   */
  | { op: "preventAttackThisTurn"; target: TargetRef }
  /**
   * ST08-009 Jegan Ground Type-A 【Deploy】 — "It won't be set as active during
   * the start phase of your opponent's next turn." Marca
   * `CardInstance.cannotActivateUntilTurn = state.turnNumber + 1` na Unit alvo
   * (Jegan sempre resolve isto no turno de quem o controla — "o próximo turno
   * do oponente" é sempre o turno seguinte); `computeStartPhaseEvents` barra
   * o `SET_ACTIVE` enquanto for o mesmo turno.
   */
  | { op: "preventActivationNextTurn"; target: TargetRef }
  /**
   * "Look at the top N cards of your deck. You may reveal 1 <filtro> card among
   * them and add it to your hand. Return the remaining cards randomly to the
   * bottom of your deck." — ST03-006 Char's Zaku Ⅱ 【Destroyed】 (docs/41,
   * primitiva nova). A carta revelada vem em `ctx.targets[revealName]` (0 ou 1
   * instanceId, escolhido antes pela camada de decisão — mesmo padrão de
   * `peekAndReorderDeck` + "named"); precisa estar no topo N e casar `filter`,
   * senão lança. Sem escolha (`optional`, jogador declina) → todas as N vão pro
   * fundo. Ordenação pro fundo segue a ordem do topo (mesma limitação de
   * `moveWithinDeck`; a aleatoriedade só esconde info de quem já olhou). */
  | { op: "lookAtTopFilterReveal"; player: PlayerRef; count: number; filter: CardDefFilter; revealName?: string }
  /**
   * "You may deploy 1 <filtro> card from your hand." disparado por gatilho
   * (【When Paired】 de ST03-010 Full Frontal, docs/41) — deploy SEM pagar custo
   * de ação nem de recurso, mas validando que a carta escolhida
   * (`ctx.targets[deployName]`) está na mão, é Unit e casa `filter` (trait/level).
   * O limite de 6 Units NÃO bloqueia (igual a `deployCard`: excesso resolvido
   * depois por rules management). Sem escolha → no-op. */
  | { op: "deployFromHandTriggered"; player: PlayerRef; filter: CardDefFilter; deployName?: string }
  /**
   * Lote 5 (docs/debates 2026-09-13) — GD01-045 "Look at the top 3 cards of your
   * deck. You may deploy 1 <filtro> Unit card among them. Return the remaining
   * cards randomly to the bottom of your deck." Mesmo padrão de `lookAtTopFilterReveal`
   * (topo N, filtro, escolha em `ctx.targets[deployName]`, resto pro fundo em ordem
   * fixa — mesma aproximação de "aleatório" já documentada ali), só que o destino
   * da carta escolhida é `battleArea` direto (deploy), não a mão.
   */
  | { op: "deployFromTopFilterReveal"; player: PlayerRef; count: number; filter: CardDefFilter; deployName?: string }
  /**
   * Lote 5 — GD01-067 "Choose 1 <filtro> card from your trash. Add it to your
   * hand." Busca na LIXEIRA (zona sempre visível, sem "topo N" — todo o trash é
   * elegível) — diferente de `lookAtTopFilterReveal` (deck, só topo N) e de
   * `deployFromHandTriggered` (mão, destino é campo). Escolha em `ctx.targets[name]`
   * (0 ou 1 instanceId); sem escolha = no-op (nada sai da lixeira).
   */
  | { op: "searchTrashToHand"; player: PlayerRef; filter: CardDefFilter; name?: string }
  /**
   * Lote 5 (docs/debates 2026-09-13) — GD01-023 "choose 1 (Newtype) Pilot card that
   * is Lv.3 or lower from your trash. Pair it with this Unit." Mesmo padrão de
   * `searchTrashToHand` (busca em ZONA INTEIRA, filtro, escolha em `ctx.targets[name]`,
   * padrão `"trashSearch"`), mas o destino é PAREAR com a fonte do efeito
   * (`ctx.sourceInstanceId`), não a mão — a carta escolhida precisa ser um Pilot
   * (`filter` garante isso, ex. `{cardType:"PILOT", ...}`).
   */
  | { op: "pairFromTrashSearch"; player: PlayerRef; filter: CardDefFilter; name?: string }
  /** GD02-071 Gundam Mk-II (AEUG) — "you may pair 1 (AEUG) Pilot card from your hand with this Unit." Mesmo padrão de `pairFromTrashSearch`, zona HAND em vez de trash. Escolha resolvida pela camada `handChoice` (`ctx.targets.deploy`), mesmo mecanismo de `deployFromHandTriggered` — não `trashSearch`, apesar do nome parecido com `pairFromTrashSearch`. */
  | { op: "pairFromHandSearch"; player: PlayerRef; filter: CardDefFilter; name?: string }
  /**
   * GD02-096 Desil Galette / GD02-110 Awakened Power — "Choose 1 <filtro> Unit card
   * from your trash. Pay its cost to deploy it." Diferente de `deployFromHandTriggered`/
   * `deployFromTopFilterReveal` (deploy SEM pagar custo, gatilho automático): aqui o
   * custo é o `CardDef.cost` da carta ESCOLHIDA (variável, só conhecido depois da
   * escolha) — resta os N primeiros Recursos active do controller (mesmo fallback
   * determinístico de `payResourceCostEvents`/`deployCard` sem `resourceInstanceIds`
   * explícito). NÃO checa o nível do jogador (`canPayLevel`) — é um efeito de carta
   * ("pay its cost to deploy it"), não a jogada normal da Main Phase (Comprehensive
   * Rules 7 só amarra o requisito de nível à ação de jogar da mão). NÃO encadeia o
   * 【Deploy】 da carta recém-deployada (mesma simplificação já aceita por
   * `deployFromHandTriggered`/`deployFromTopFilterReveal` — nenhuma delas dispara
   * automaticamente). Zona é TRASH (busca em zona inteira, não "topo N") — reusa o
   * MESMO shape `trashSearch` de `searchTrashToHand`/`pairFromTrashSearch` na camada
   * de decisão; escolha em `ctx.targets[deployName ?? "trashSearch"]`.
   */
  | { op: "deployFromTrashPayingCost"; player: PlayerRef; filter: CardDefFilter; deployName?: string }
  /**
   * Lote 5 — GD01-039 "Look at the top card of your deck. Return it to the top
   * or bottom of your deck." Ao contrário de `moveWithinDeck` (posição FIXA,
   * decidida por quem autora), aqui a POSIÇÃO em si é a escolha do jogador —
   * reaproveita o mesmo mecanismo de `spawnTokenChoice` (escolha enum, `enumChoice`
   * na camada de decisão), só que as opções são sempre "top"/"bottom" fixas (não
   * precisa de `CardDef` por opção). Sempre atua sobre o TOPO do deck agora (só
   * 1 carta — sem ambiguidade de qual).
   */
  | { op: "moveTopCardToChosenPosition"; player: PlayerRef; optionsKey: string }
  /**
   * "【Burst】Deploy this card." — coloca a PRÓPRIA carta (BASE → baseSection,
   * UNIT → battleArea) em campo, aplicando a regra de 1 Base (a Base atual vai
   * pro trash, ou pro exílio se for token). Depois disso o `dispatcher.ts`
   * ENCADEIA o 【Deploy】 da carta (Add 1 Shield / token / dano). Sem esta
   * primitiva o Burst usava `moveZone self → baseSection`, que não trocava a
   * Base nem disparava o 【Deploy】 (docs/47 Classe B). */
  | { op: "deployThisCard" }
  /** ST07-001 Gundam Exia — "Place the top N cards of your deck into your trash. If you place a <trait> card with this effect, draw 1." */
  | { op: "millToTrash"; player: PlayerRef; count: number; drawIfTraitMilled?: string };

/**
 * Filtro sobre um `CardDef` — usado pelas primitivas que escolhem carta por
 * característica (não por instância já em campo). `anyTrait` casa se o def tem
 * QUALQUER um dos traits (traits do dataset vêm como "Zeon", "Neo Zeon"; o
 * texto oficial usa "(Zeon)/(Neo Zeon)" — normalize os parênteses ao montar o
 * spec). `maxLevel`/`minLevel` inclusivos.
 */
export interface CardDefFilter {
  cardType?: CardDef["cardType"];
  /** Lote 2 (docs/debates 2026-09-13) — GD01-109 "Unit card/Pilot card" (2 tipos possíveis, OR). Mutuamente exclusivo com `cardType` na prática (cartas reais só usam 1 dos 2), mas ambos coexistem sem conflito se algum dia precisar. */
  anyCardType?: CardDef["cardType"][];
  anyTrait?: string[];
  maxLevel?: number;
  minLevel?: number;
  /** GD02-112 Momentary Respite — "1 purple Pilot card from your trash". Cor IMPRESSA da carta, não trait. */
  color?: CardDef["color"];
  /** GD02-088 — "1 card with \"AGE Device\" in its card name" (nome impresso em inglês contém o trecho). */
  nameContains?: string;
  /** GD02-088 — "1 green (EF) Unit card/1 card with \"AGE Device\"…": casa se QUALQUER um dos filtros casar (além dos campos acima). */
  anyOf?: CardDefFilter[];
}

export function matchesCardDefFilter(def: CardDef, filter: CardDefFilter): boolean {
  if (filter.nameContains && !def.nameEn.includes(filter.nameContains)) return false;
  if (filter.anyOf && filter.anyOf.length > 0 && !filter.anyOf.some((f) => matchesCardDefFilter(def, f))) return false;
  if (filter.cardType && def.cardType !== filter.cardType) return false;
  if (filter.anyCardType && filter.anyCardType.length > 0 && !filter.anyCardType.includes(def.cardType)) return false;
  if (filter.color && def.color !== filter.color) return false;
  if (filter.anyTrait && filter.anyTrait.length > 0) {
    const traits = def.traits ?? [];
    if (!filter.anyTrait.some((t) => traits.includes(t))) return false;
  }
  if (filter.maxLevel !== undefined && (def.level ?? 0) > filter.maxLevel) return false;
  if (filter.minLevel !== undefined && (def.level ?? 0) < filter.minLevel) return false;
  return true;
}

export interface EffectContext {
  state: GameState;
  controller: PlayerId;
  sourceInstanceId: string;
  turnNumber: number;
  /** grupos de alvo já resolvidos (por seletor externo) antes de rodar o efeito */
  targets: Record<string, string[]>;
  /**
   * Recursos escolhidos pelo jogador pra pagar `payResourceCost` de uma
   * habilidade ativada (`activateAbility`) — evita o motor pegar os N primeiros
   * active (que inclui o EX Resource, sempre no índice 0). `undefined` =
   * comportamento antigo (auto-pick). O `resourceInstanceIds` da própria
   * primitiva (raro) ainda tem prioridade.
   */
  costResourceIds?: string[];
}

/**
 * Traduz uma única primitiva em 0+ GameEvent. Não muta nada — só lê
 * `ctx.state` pra resolver referência (ex.: saber quem é dono de uma
 * instância) e devolve eventos, que quem chama aplica com `applyEvents`.
 */
export function compilePrimitive(call: PrimitiveCall, ctx: EffectContext): GameEvent[] {
  switch (call.op) {
    case "draw": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const events: GameEvent[] = [];
      const deck = ctx.state.players[player].deck;
      for (let i = 0; i < call.n && i < deck.length; i++) {
        events.push({ type: "DRAW_CARD", player, from: "deck", instanceId: deck[i]?.instanceId ?? null });
      }
      return events;
    }
    case "discard": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      return [{ type: "DISCARD_TO_HAND_LIMIT", player, instanceIds: call.instanceIds }];
    }
    case "discardNamed": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const chosen = (ctx.targets[call.name] ?? []).slice(0, call.n);
      if (chosen.length === 0) return [];
      if (call.filter) {
        for (const id of chosen) {
          const card = findCard(ctx.state, id);
          if (!matchesCardDefFilter(card.def, call.filter)) {
            throw new Error(`discardNamed: "${card.def.code}" não casa o filtro do custo`);
          }
        }
      }
      return [{ type: "DISCARD_TO_HAND_LIMIT", player, instanceIds: chosen }];
    }
    case "damageShield": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      return [{ type: "DAMAGE_SHIELD", player, count: call.count }];
    }
    case "destroy": {
      const events: GameEvent[] = [];
      for (const instanceId of resolveTargetIds(call.target, ctx)) {
        events.push({ type: "DESTROY_CARD", instanceId });
        events.push(...pairedPilotFollowEvents(findCard(ctx.state, instanceId)));
      }
      return events;
    }
    case "moveZone": {
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "MOVE_CARD", instanceId, toZone: call.toZone }));
    }
    case "modifyStat": {
      const events: GameEvent[] = [];
      for (const instanceId of resolveTargetIds(call.target, ctx)) {
        events.push({
          type: "MODIFY_STAT",
          instanceId,
          modifier: { stat: call.stat, amount: call.amount, duration: call.duration, appliedOnTurn: ctx.turnNumber, appliedBy: ctx.controller },
        });
        // GD02-009 Calamity Gundam — "when this Unit's AP is reduced by an enemy effect,
        // choose 1 rested enemy Unit. Deal 2 damage to it." Sem sistema de escolha REAL
        // pra reação (não passa pelo dispatcher normal) — auto-mira a 1ª Unit inimiga
        // rested legal, mesma simplificação documentada já usada em combatTriggers antigos.
        const target = findCard(ctx.state, instanceId);
        const reaction = call.stat === "ap" && call.amount < 0 ? target.def.onApReducedByEnemy : undefined;
        if (reaction && target.owner !== ctx.controller) {
          const usageMarker = "onApReducedByEnemy";
          if (!reaction.oncePerTurn || !target.usedKeywordsThisTurn.includes(usageMarker)) {
            if (reaction.oncePerTurn) events.push({ type: "MARK_KEYWORD_USED", instanceId, keyword: usageMarker });
            const enemyUnit = ctx.state.players[target.owner === "A" ? "B" : "A"].battleArea.find((c) => c.def.cardType === "UNIT" && c.rested);
            if (enemyUnit) events.push({ type: "DAMAGE_UNIT", instanceId: enemyUnit.instanceId, amount: reaction.reactDamage });
          }
        }
      }
      return events;
    }
    case "grantKeyword": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({
          type: "GRANT_KEYWORD",
          instanceId,
          grant: { keyword: call.keyword, duration: call.duration, appliedOnTurn: ctx.turnNumber },
        }),
      );
    }
    case "rest": {
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "REST_CARD", instanceId }));
    }
    case "setActive": {
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "SET_ACTIVE", instanceId }));
    }
    case "heal": {
      const events: GameEvent[] = [];
      for (const instanceId of resolveTargetIds(call.target, ctx)) {
        events.push({ type: "HEAL_UNIT", instanceId, amount: call.amount });
        events.push(...selfHealReactionEvents(findCard(ctx.state, instanceId), ctx.state));
      }
      return events;
    }
    case "damageUnit": {
      const events: GameEvent[] = [];
      for (const instanceId of resolveTargetIds(call.target, ctx)) {
        const card = findCard(ctx.state, instanceId);
        if (isProtectedFromEffectDamage(card, ctx)) continue;
        events.push({ type: "DAMAGE_UNIT", instanceId, amount: call.amount });
        // GD02-010 Raider Gundam — "when this Unit receives enemy effect damage, draw 1."
        if (card.def.onEffectDamageReceived && card.owner !== ctx.controller) {
          const usageMarker = "onEffectDamageReceived";
          if (!card.def.onEffectDamageReceived.oncePerTurn || !card.usedKeywordsThisTurn.includes(usageMarker)) {
            if (card.def.onEffectDamageReceived.oncePerTurn) events.push({ type: "MARK_KEYWORD_USED", instanceId, keyword: usageMarker });
            events.push({ type: "DRAW_CARD", player: card.owner, from: "deck", instanceId: ctx.state.players[card.owner].deck[0]?.instanceId ?? null });
          }
        }
        if (card.damage + call.amount >= effectiveHp(card, ctx.state)) {
          events.push({ type: "DESTROY_CARD", instanceId });
          events.push(...pairedPilotFollowEvents(card));
        }
      }
      return events;
    }
    case "damageBattlingBaseOrShield": {
      const events: GameEvent[] = [];
      for (const instanceId of resolveTargetIds(call.target, ctx)) {
        const card = findCard(ctx.state, instanceId);
        if (card.zone === "shields") {
          // Shield "tem 1 HP" (Comprehensive Rules) — qualquer dano destrói inteiro,
          // não acumula (mesma regra de shieldDamageEvents/breachEvents em combat.ts).
          events.push({ type: "DESTROY_CARD", instanceId });
          continue;
        }
        // Base — dano acumulado normal, mesma fórmula/proteções de "damageUnit".
        if (isProtectedFromEffectDamage(card, ctx)) continue;
        events.push({ type: "DAMAGE_UNIT", instanceId, amount: call.amount });
        if (card.damage + call.amount >= effectiveHp(card, ctx.state)) {
          events.push({ type: "DESTROY_CARD", instanceId });
        }
      }
      return events;
    }
    case "payResourceCost": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      return payResourceCostEvents(ctx.state, player, call.n, call.resourceInstanceIds ?? ctx.costResourceIds);
    }
    case "spawnToken": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const count = call.count ?? 1;
      const events: GameEvent[] = Array.from(
        { length: count },
        (): GameEvent => ({ type: "SPAWN_TOKEN", player, def: call.def, zone: call.zone, rested: call.rested }),
      );
      // GD02-022 G-Exes — "when you place an EX Resource, choose 1 of your (AGE System)
      // Units. It gains <Breach 2> during this turn."
      if (call.def.code === TOKEN_EX_RESOURCE_CODE) {
        for (const listener of ctx.state.players[player].battleArea) {
          const reaction = listener.def.onExResourcePlaced;
          if (!reaction) continue;
          const usageMarker = "onExResourcePlaced";
          if (reaction.oncePerTurn && listener.usedKeywordsThisTurn.includes(usageMarker)) continue;
          const target = ctx.state.players[player].battleArea.find(
            (c) => c.def.cardType === "UNIT" && (!reaction.requiresTargetTrait || (c.def.traits ?? []).includes(reaction.requiresTargetTrait)),
          );
          if (!target) continue;
          if (reaction.oncePerTurn) events.push({ type: "MARK_KEYWORD_USED", instanceId: listener.instanceId, keyword: usageMarker });
          events.push({
            type: "GRANT_KEYWORD",
            instanceId: target.instanceId,
            grant: { keyword: reaction.grantKeyword, duration: "endOfTurn", appliedOnTurn: ctx.turnNumber },
          });
        }
      }
      return events;
    }
    case "spawnTokenByOwnUnitCount": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const unitCount = ctx.state.players[player].battleArea.filter((c) => c.def.cardType === "UNIT").length;
      const sorted = [...call.thresholds].sort((a, b) => a.maxUnits - b.maxUnits);
      const match = sorted.find((t) => unitCount <= t.maxUnits);
      if (!match) return [];
      return [{ type: "SPAWN_TOKEN", player, def: match.def, zone: call.zone }];
    }
    case "moveWithinDeck": {
      // Reordenar o topo do deck é uma decisão de quem controla (ver
      // `peekAndReorderDeck`): se ninguém decidiu (`ctx.targets` sem a entrada
      // nomeada — ex. Burst→Base Deploy, que não passa pela camada de decisão),
      // é no-op, o deck fica como está — resultado legal, não erro.
      if (call.target.kind === "named" && !ctx.targets[call.target.name]?.length) return [];
      return resolveTargetIds(call.target, ctx).map((instanceId): GameEvent => ({ type: "MOVE_WITHIN_DECK", instanceId, position: call.position }));
    }
    case "spawnTokenChoice": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const chosen = ctx.targets[call.key]?.[0];
      const match = call.options.find((o) => o.value === chosen) ?? call.options[0];
      return [{ type: "SPAWN_TOKEN", player, def: match.def, zone: call.zone }];
    }
    case "preventShieldDamage": {
      return [{ type: "SET_SHIELD_PROTECTION", maxAttackerLevel: call.maxAttackerLevel }];
    }
    case "preventUnitBattleDamage": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({
          type: "SET_UNIT_DAMAGE_PROTECTION",
          instanceId,
          maxAttackerAp: call.maxAttackerAp,
          maxAttackerLevel: call.maxAttackerLevel,
          unconditional: call.unconditional,
        }),
      );
    }
    case "grantAttackTargetRelax": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({
          type: "GRANT_ATTACK_TARGET_RELAX",
          instanceId,
          maxLevel: call.maxLevel,
          maxAp: call.maxAp,
          turn: ctx.turnNumber,
        }),
      );
    }
    case "grantBattleDamageImmunityUntilTurn": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({
          type: "GRANT_BATTLE_DAMAGE_IMMUNITY_UNTIL_TURN",
          instanceId,
          maxAttackerHp: call.maxAttackerHp,
          turn: ctx.turnNumber,
        }),
      );
    }
    case "preventAttackThisTurn": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({ type: "SET_CANNOT_ATTACK", instanceId, turn: ctx.turnNumber }),
      );
    }
    case "preventActivationNextTurn": {
      return resolveTargetIds(call.target, ctx).map(
        (instanceId): GameEvent => ({ type: "SET_CANNOT_ACTIVATE", instanceId, turn: ctx.turnNumber + 1 }),
      );
    }
    case "addShieldToHand": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const shields = ctx.state.players[player].shields;
      const chosen = ctx.targets.shield?.length
        ? ctx.targets.shield.slice(0, call.count)
        : shields.slice(0, call.count).map((s) => s.instanceId);
      return chosen.map((instanceId): GameEvent => ({ type: "MOVE_CARD", instanceId, toZone: "hand" }));
    }
    case "lookAtTopFilterReveal": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const top = ctx.state.players[player].deck.slice(0, call.count);
      const revealed = ctx.targets[call.revealName ?? "reveal"]?.[0];
      const events: GameEvent[] = [];
      if (revealed) {
        const card = top.find((c) => c.instanceId === revealed);
        if (!card) throw new Error(`lookAtTopFilterReveal: carta revelada "${revealed}" não está no topo ${call.count} do deck`);
        if (!matchesCardDefFilter(card.def, call.filter)) {
          throw new Error(`lookAtTopFilterReveal: carta revelada "${card.def.code}" não casa o filtro exigido pelo efeito`);
        }
        events.push({ type: "MOVE_CARD", instanceId: revealed, toZone: "hand" });
      }
      for (const card of top) {
        if (card.instanceId === revealed) continue;
        events.push({ type: "MOVE_WITHIN_DECK", instanceId: card.instanceId, position: "bottom" });
      }
      return events;
    }
    case "deployThisCard": {
      const source = findCard(ctx.state, ctx.sourceInstanceId);
      if (source.def.cardType === "BASE") {
        const events: GameEvent[] = [];
        const existing = ctx.state.players[source.owner].baseSection[0];
        if (existing && existing.instanceId !== ctx.sourceInstanceId) {
          events.push(
            existing.def.isToken
              ? { type: "REMOVE_CARD_FROM_GAME", instanceId: existing.instanceId }
              : { type: "MOVE_CARD", instanceId: existing.instanceId, toZone: "trash" },
          );
        }
        events.push({ type: "MOVE_CARD", instanceId: ctx.sourceInstanceId, toZone: "baseSection" });
        return events;
      }
      if (source.def.cardType === "UNIT") {
        return [{ type: "MOVE_CARD", instanceId: ctx.sourceInstanceId, toZone: "battleArea" }];
      }
      throw new Error(`deployThisCard: ${source.def.code} não é BASE nem UNIT`);
    }
    case "deployFromHandTriggered": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const chosen = ctx.targets[call.deployName ?? "deploy"]?.[0];
      if (!chosen) return [];
      const card = ctx.state.players[player].hand.find((c) => c.instanceId === chosen);
      if (!card) throw new Error(`deployFromHandTriggered: carta "${chosen}" não está na mão de ${player}`);
      if (card.def.cardType !== "UNIT") throw new Error(`deployFromHandTriggered: "${card.def.code}" não é Unit`);
      if (!matchesCardDefFilter(card.def, call.filter)) {
        throw new Error(`deployFromHandTriggered: "${card.def.code}" não casa o filtro do efeito`);
      }
      return [{ type: "MOVE_CARD", instanceId: chosen, toZone: "battleArea" }];
    }
    case "deployFromTopFilterReveal": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const top = ctx.state.players[player].deck.slice(0, call.count);
      // "reveal" (não "deploy") — mesma chave que `resolveAbility` já escreve pra
      // QUALQUER escolha baseada em `q.deckTopReveal` (compartilhada com `lookAtTopFilterReveal`).
      const chosen = ctx.targets[call.deployName ?? "reveal"]?.[0];
      const events: GameEvent[] = [];
      if (chosen) {
        const card = top.find((c) => c.instanceId === chosen);
        if (!card) throw new Error(`deployFromTopFilterReveal: carta "${chosen}" não está no topo ${call.count} do deck`);
        if (card.def.cardType !== "UNIT") throw new Error(`deployFromTopFilterReveal: "${card.def.code}" não é Unit`);
        if (!matchesCardDefFilter(card.def, call.filter)) {
          throw new Error(`deployFromTopFilterReveal: "${card.def.code}" não casa o filtro do efeito`);
        }
        events.push({ type: "MOVE_CARD", instanceId: chosen, toZone: "battleArea" });
      }
      for (const card of top) {
        if (card.instanceId === chosen) continue;
        events.push({ type: "MOVE_WITHIN_DECK", instanceId: card.instanceId, position: "bottom" });
      }
      return events;
    }
    case "searchTrashToHand": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const chosen = ctx.targets[call.name ?? "trashSearch"]?.[0];
      if (!chosen) return [];
      const card = ctx.state.players[player].trash.find((c) => c.instanceId === chosen);
      if (!card) throw new Error(`searchTrashToHand: carta "${chosen}" não está na lixeira de ${player}`);
      if (!matchesCardDefFilter(card.def, call.filter)) {
        throw new Error(`searchTrashToHand: "${card.def.code}" não casa o filtro do efeito`);
      }
      return [{ type: "MOVE_CARD", instanceId: chosen, toZone: "hand" }];
    }
    case "pairFromTrashSearch": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const chosen = ctx.targets[call.name ?? "trashSearch"]?.[0];
      if (!chosen) return [];
      const card = ctx.state.players[player].trash.find((c) => c.instanceId === chosen);
      if (!card) throw new Error(`pairFromTrashSearch: carta "${chosen}" não está na lixeira de ${player}`);
      if (!matchesCardDefFilter(card.def, call.filter)) {
        throw new Error(`pairFromTrashSearch: "${card.def.code}" não casa o filtro do efeito`);
      }
      return [
        { type: "MOVE_CARD", instanceId: chosen, toZone: "battleArea" },
        { type: "PAIR_CARDS", pilotId: chosen, unitId: ctx.sourceInstanceId, asPilotMode: false },
      ];
    }
    case "pairFromHandSearch": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      // Busca em HAND (não trash) — a camada de decisão usa o shape `handChoice`
      // (mesmo de `deployFromHandTriggered`), que escreve em `ctx.targets.deploy`,
      // não `trashSearch` (achado da revalidação Sprint 2 Fase 7 — GD02-071 só
      // funcionava via `resolveEffectSpec` direto de teste, nunca pelo caminho
      // real da UI, porque `abilityDispatch.ts` não tinha um branch pra este op).
      const chosen = ctx.targets[call.name ?? "deploy"]?.[0];
      if (!chosen) return [];
      const card = ctx.state.players[player].hand.find((c) => c.instanceId === chosen);
      if (!card) throw new Error(`pairFromHandSearch: carta "${chosen}" não está na mão de ${player}`);
      if (!matchesCardDefFilter(card.def, call.filter)) {
        throw new Error(`pairFromHandSearch: "${card.def.code}" não casa o filtro do efeito`);
      }
      return [
        { type: "MOVE_CARD", instanceId: chosen, toZone: "battleArea" },
        { type: "PAIR_CARDS", pilotId: chosen, unitId: ctx.sourceInstanceId, asPilotMode: false },
      ];
    }
    case "deployFromTrashPayingCost": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const chosen = ctx.targets[call.deployName ?? "trashSearch"]?.[0];
      if (!chosen) return [];
      const card = ctx.state.players[player].trash.find((c) => c.instanceId === chosen);
      if (!card) throw new Error(`deployFromTrashPayingCost: carta "${chosen}" não está na lixeira de ${player}`);
      if (card.def.cardType !== "UNIT") throw new Error(`deployFromTrashPayingCost: "${card.def.code}" não é Unit`);
      if (!matchesCardDefFilter(card.def, call.filter)) {
        throw new Error(`deployFromTrashPayingCost: "${card.def.code}" não casa o filtro do efeito`);
      }
      const cost = effectiveCost(card.def, ctx.state, player);
      return [...payResourceCostEvents(ctx.state, player, cost), { type: "MOVE_CARD", instanceId: chosen, toZone: "battleArea" }];
    }
    case "moveTopCardToChosenPosition": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const top = ctx.state.players[player].deck[0];
      if (!top) return [];
      const chosen = ctx.targets[call.optionsKey]?.[0];
      const position = chosen === "top" ? "top" : "bottom";
      return [{ type: "MOVE_WITHIN_DECK", instanceId: top.instanceId, position }];
    }
    case "returnTrashToDeckAndShuffle": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const chosen = ctx.state.players[player].trash.slice(0, call.count);
      if (chosen.length === 0) return [];
      return [{ type: "RETURN_TRASH_TO_DECK_SHUFFLE", player, instanceIds: chosen.map((c) => c.instanceId) }];
    }
    case "millToTrash": {
      const player = resolvePlayerRef(call.player, ctx.controller);
      const deck = ctx.state.players[player].deck;
      const milled = deck.slice(0, call.count);
      const events: GameEvent[] = [];
      for (const card of milled) {
        events.push({ type: "MOVE_CARD", instanceId: card.instanceId, toZone: "trash" });
      }
      if (call.drawIfTraitMilled && milled.some((c) => (c.def.traits ?? []).includes(call.drawIfTraitMilled!))) {
        events.push({ type: "DRAW_CARD", player, from: "deck", instanceId: null });
      }
      return events;
    }
  }
}

/**
 * "Look at the top N cards of your deck" (ex.: ST02-015 Saint Gabriel
 * Institute) — leitura pura, sem evento: só devolve as N cartas do topo pra
 * quem for decidir a reordenação (UI/IA/teste) montar `ctx.targets` antes de
 * chamar `resolveEffectSpec` (mesmo padrão de "named" já usado por
 * "target"/"shield" em toda carta com escolha externa). A reordenação em si
 * é feita depois, via a primitiva `moveWithinDeck` (docs/18, lacuna #8).
 */
export function peekAndReorderDeck(state: GameState, player: PlayerId, n: number): CardInstance[] {
  return state.players[player].deck.slice(0, n);
}

export function compileActions(calls: PrimitiveCall[], ctx: EffectContext): GameEvent[] {
  return calls.flatMap((call) => compilePrimitive(call, ctx));
}

/**
 * Uma condição if/then/else. `predicate` é um id/descrição avaliado por um
 * `PredicateResolver` registrado externamente — a Fase 1 ainda não define
 * nenhum predicado real (isso nasce junto com o primeiro efeito bespoke
 * autorado, passo 3 do plano incremental).
 */
export interface EffectCondition {
  predicate: string;
  then: PrimitiveCall[];
  else?: PrimitiveCall[];
}

export type PredicateResolver = (predicate: string, ctx: EffectContext) => boolean;

/** Um efeito bespoke de uma carta específica, revisável lado a lado com o texto oficial. */
export interface EffectSpec {
  /** id legível — "<code>-<trigger>", ex.: "GD01-001-Deploy" */
  id: string;
  cardCode: string;
  /** rótulo do textSectionsJson correspondente — "Deploy" | "Attack" | "Destroyed" | "Burst" | "Activate·Main" | "Activate·Action" | etc. */
  trigger: string;
  cost?: PrimitiveCall[];
  condition?: EffectCondition;
  /**
   * GD02-021 Gundam AGE-1 Normal — "You may discard 1 ... . If you do, place 1 EX Resource.
   * Then, if you are Lv.7 or higher, draw 1." Duas cláusulas "if" INDEPENDENTES na mesma carta
   * (a segunda não depende da primeira ter disparado) — `condition` sozinho só suporta 1 par
   * predicate→then/else. Avaliada separadamente, na mesma ordem cost→condition→condition2→actions.
   */
  condition2?: EffectCondition;
  actions: PrimitiveCall[];
  /** effectEn da seção correspondente — nunca effectPt (ver docs/18, cobertura de idioma) */
  sourceText: string;
  /**
   * `true` quando o texto oficial diz "You may ..." (o jogador escolhe ativar
   * ou pular). Default `false` = mandatório (resolve, ou não faz nada se não há
   * alvo legal). Nenhum efeito de ST01/ST02 é opcional.
   */
  optional?: boolean;
  /**
   * `true` quando o texto oficial prefixa o gatilho com 【During Pair】 (ex.
   * ST04-009 Miguel's Ginn 【During Pair】【Destroyed】) — quem despacha só ativa
   * o efeito se a Unit fonte estava PAREADA no momento do gatilho. Hoje só
   * consultado por `dispatchDestroyedTriggers` (via `DestroyedInBattle.wasPaired`).
   */
  duringPair?: boolean;
  /**
   * Lote 5 (docs/debates 2026-09-13) — `true` quando o texto oficial prefixa o
   * gatilho com 【During Link】 (ex. GD01-005 Unicorn Gundam 【During Link】【Destroyed】)
   * — mais estrito que `duringPair`: exige que a Unit fonte satisfizesse a condição
   * de Link (Pilot pareado bate com `link` da Unit), não só estar pareada com
   * QUALQUER Pilot. Só consultado por `dispatchDestroyedTriggers`/`dispatchDestroyedFromEffect`
   * (via `DestroyedInBattle.wasLinkUnit`).
   */
  duringLink?: boolean;
  /**
   * O que `ctx.targets.target` deve ser — a UI usa pra montar a lista de alvos
   * possíveis quando o efeito pausa pra escolha. Default `"enemyUnit"`.
   * `"anyUnit"` — GD01-014/GD01-058/GD01-110, texto oficial "Choose 1 Unit"
   * (sem "enemy"/"friendly") — pool são as Units dos DOIS lados do tabuleiro.
   */
  /** GD02-075 Rick Dias (Red) / GD02-069 Zeta Gundam — "Choose 1 active friendly Base." */
  /** GD02-120 Aspiring Pilot — "Choose 1 of your (AEUG) Units/Bases." (pool = Units E Bases do controller, filtro de trait aplica aos dois.) */
  targetScope?: "enemyUnit" | "ownResource" | "friendlyUnit" | "anyUnit" | "friendlyBase" | "friendlyUnitOrBase" | "battlingBaseOrShield";
  /**
   * Restrição do texto oficial ALÉM da categoria ampla de `targetScope` — ex.
   * "with 2 or less HP" (Guntank), "Lv.5 or lower" (Aerial), "rested"
   * (Thoroughly Damaged, Suletta Mercury — "Set 1 Resource as active" só faz
   * sentido num Recurso descansado). Resolvido por CANDIDATO (uma instância
   * por vez), não pelo `EffectContext` inteiro — ver `TargetFilterResolver`
   * e `computeLegalTargets`. Ausente = qualquer card do `targetScope` é
   * legal (comportamento de antes do V0, docs/24).
   */
  targetFilter?: string;
  /**
   * Lote 4 (docs/debates 2026-09-13) — cardinalidade da escolha de `ctx.targets.target`
   * quando as `actions`/`condition` usam `{ kind: "namedGroup", name: "target" }` em vez
   * de `"named"`. Ausente = escolha singular de sempre (1 alvo, `"named"`).
   * `min`/`max` ex.: GD01-044 "Choose 1 to 2" -> `{min:1,max:2}`; GD01-112/114
   * "Choose 2" -> `{min:2,max:2}` (mas o pool pode ter menos de `min` candidatos —
   * `resolveAbility`/bots então escolhem o que houver, nunca mais que `max`).
   * A UI de resolução hoje só oferece seleção SINGULAR (`AbilityResolutionModal.tsx`)
   * — um jogador humano escolhe no máximo 1 destes até a UI ganhar seletor múltiplo;
   * bots/testes escolhem o pool inteiro até `max` (`legalActions.ts`).
   */
  targetCount?: { min: number; max: number };
  /**
   * Lote 5 (docs/debates 2026-09-13) — 2º pool de alvo, com ESCOPO PRÓPRIO
   * (diferente do pool principal de `targetScope`/`targetFilter`/`ctx.targets.target`),
   * pra specs "Choose 1 X e 1 Y" onde X e Y são de lados/filtros diferentes
   * (ex. GD01-103 "1 friendly Unit e 1 enemy Unit", GD01-112 "2 friendly Units
   * ... choose 1 enemy Unit"). Consome `ctx.targets[name]` via `{kind:"named", name}`
   * nas `actions`/`condition` — só COMMAND (Main/Action) usa isto hoje: a carta
   * resolve com `action.targets` já pronto (não passa pela fila de PendingDecision),
   * então não precisou de mudança no formato de `PlayerAction`/`resolveAbility`,
   * só em `legalActions.ts` (enumeração gulosa: 1º alvo legal de cada pool).
   */
  secondaryTarget?: { name: string; targetScope: "enemyUnit" | "ownResource" | "friendlyUnit" | "anyUnit"; targetFilter?: string };
}

/**
 * Resolve um `targetFilter` (string) contra UM candidato — mesmo padrão de
 * extensão do `PredicateResolver` (id-string + resolver registrado), só que
 * por instância em vez de pelo `EffectContext` inteiro. Implementação real
 * em `content/predicates.ts` (`defaultTargetFilterResolver`) — mesmo motivo
 * do `defaultPredicateResolver`: única fonte, reusada por testes e servidor.
 */
/**
 * `sourceInstanceId` (Lote 5, docs/debates 2026-09-13) é opcional — só filtros
 * AUTO-REFERENTES à fonte (ex. "level<=self", GD01-093) precisam dele. Ausente
 * = filtro auto-referente não resolve (mesma postura de falhar alto/ignorar
 * já usada pros outros filtros ausentes de contexto).
 */
export type TargetFilterResolver = (
  filter: string,
  candidate: CardInstance,
  ctx: { state: GameState; sourceInstanceId?: string },
) => boolean;

/**
 * Enumera os alvos LEGAIS de `spec.targetScope` (+ `spec.targetFilter`, se
 * houver) no estado ATUAL — única fonte de verdade, chamada tanto pra montar
 * a lista que a UI mostra quanto pra VALIDAR o que o cliente manda de volta
 * (nunca confiar só na UI escondendo a opção ilegal — ver `docs/25`). Pool
 * sempre pequeno (Battle Area ≤6 Units, Resource Area ≤~15 cartas) — o custo
 * é desprezível; o cuidado real é só chamar isto nos pontos de DECISÃO
 * (`deferOrDispatchAbilities`, `resolveAbility`, `playCommand`/
 * `activateAbility`), nunca dentro de um loop de render.
 *
 * Lança se o spec declara `targetFilter` mas nenhum `resolveFilter` foi
 * passado — mesma postura de `resolveEffectSpec` pra `condition` (falhar
 * alto em vez de aplicar o filtro em silêncio).
 */
export function computeLegalTargets(
  state: GameState,
  spec: Pick<EffectSpec, "targetScope" | "targetFilter">,
  controller: PlayerId,
  resolveFilter?: TargetFilterResolver,
  sourceInstanceId?: string,
): string[] {
  const scope = spec.targetScope ?? "enemyUnit";
  const pool: CardInstance[] =
    scope === "enemyUnit"
      ? state.players[otherPlayer(controller)].battleArea.filter((c) => c.def.cardType === "UNIT")
      : scope === "friendlyUnit"
        ? state.players[controller].battleArea.filter((c) => c.def.cardType === "UNIT")
        : scope === "anyUnit"
          ? [...state.players.A.battleArea, ...state.players.B.battleArea].filter((c) => c.def.cardType === "UNIT")
          : scope === "friendlyBase"
            ? state.players[controller].baseSection
            : scope === "friendlyUnitOrBase"
              ? [...state.players[controller].battleArea.filter((c) => c.def.cardType === "UNIT"), ...state.players[controller].baseSection]
              : scope === "battlingBaseOrShield"
                ? (() => {
                    // GD02-011 Moebius — "Choose 1 enemy Base/enemy Shield this Unit is
                    // battling." Só existe pool quando `sourceInstanceId` é o ATACANTE de um
                    // combate em andamento contra o JOGADOR (não uma Unit rested) — nesse
                    // caso a Base (se houver) e TODOS os Shields do defensor são elegíveis
                    // (mesmo par de zonas que `resolveDamageStep` intercepta automaticamente
                    // no dano de batalha comum: Base absorve antes, senão Shield).
                    const combat = state.combat;
                    if (!combat || !sourceInstanceId || combat.attackerId !== sourceInstanceId || combat.currentTarget !== "player") return [];
                    const defender = state.players[combat.defendingPlayer];
                    return [...defender.baseSection, ...defender.shields];
                  })()
                : state.players[controller].resourceArea;

  if (!spec.targetFilter) return pool.map((c) => c.instanceId);
  if (!resolveFilter) {
    throw new Error(`EffectSpec com targetFilter "${spec.targetFilter}" mas nenhum TargetFilterResolver foi passado`);
  }
  return pool.filter((c) => resolveFilter(spec.targetFilter!, c, { state, sourceInstanceId })).map((c) => c.instanceId);
}

/**
 * `true` se algum `PrimitiveCall` de `calls` consome o alvo nomeado `"target"`.
 */
export function callsNeedNamedTarget(calls: PrimitiveCall[] | undefined): boolean {
  return (calls ?? []).some((call) => {
    const target = (call as { target?: { kind?: string; name?: string } }).target;
    return (target?.kind === "named" || target?.kind === "namedGroup") && target.name === "target";
  });
}

/**
 * `true` se algum `PrimitiveCall` do spec (em `actions`, `condition.then` ou
 * `condition.else`) consome o alvo nomeado `"target"` (`ctx.targets.target`).
 * Usado pra decidir se um gatilho precisa de interação do jogador.
 */
export function specNeedsNamedTarget(spec: EffectSpec): boolean {
  return (
    callsNeedNamedTarget(spec.actions) ||
    callsNeedNamedTarget(spec.condition?.then) ||
    callsNeedNamedTarget(spec.condition?.else) ||
    callsNeedNamedTarget(spec.condition2?.then) ||
    callsNeedNamedTarget(spec.condition2?.else)
  );
}

/**
 * Primitivas que exigem uma ESCOLHA feita fora do "alvo em campo"
 * (`ctx.targets.target`, uma Unit/Recurso visível no tabuleiro):
 *  - `deployFromHandTriggered` (ST03-010) / `discardNamed` (ST04-002) → carta da MÃO
 *  - `lookAtTopFilterReveal` (ST03-006) / `moveWithinDeck` nomeado (ST02-015) → topo do DECK
 *  - `spawnTokenChoice` (ST04-012) → escolha ENUM (Sword / Launcher)
 * A camada de decisão (`abilityDispatch.ts`) monta `handChoice`/`deckTopReveal`/
 * `handDiscard`/`deckReorder`/`enumChoice` na fila da `PendingDecision` e marca
 * o gatilho como interativo mesmo quando `optional` é `false`.
 */
export type ChoicePrimitive =
  | Extract<PrimitiveCall, { op: "deployFromHandTriggered" }>
  | Extract<PrimitiveCall, { op: "lookAtTopFilterReveal" }>
  | Extract<PrimitiveCall, { op: "discardNamed" }>
  | Extract<PrimitiveCall, { op: "spawnTokenChoice" }>
  | Extract<PrimitiveCall, { op: "moveWithinDeck" }>
  | Extract<PrimitiveCall, { op: "deployFromTopFilterReveal" }>
  | Extract<PrimitiveCall, { op: "searchTrashToHand" }>
  | Extract<PrimitiveCall, { op: "pairFromTrashSearch" }>
  | Extract<PrimitiveCall, { op: "pairFromHandSearch" }>
  | Extract<PrimitiveCall, { op: "deployFromTrashPayingCost" }>
  | Extract<PrimitiveCall, { op: "moveTopCardToChosenPosition" }>;

export function isChoicePrimitive(call: PrimitiveCall): call is ChoicePrimitive {
  switch (call.op) {
    case "deployFromHandTriggered":
    case "lookAtTopFilterReveal":
    case "discardNamed":
    case "spawnTokenChoice":
    case "deployFromTopFilterReveal":
    case "searchTrashToHand":
    case "pairFromTrashSearch":
    case "pairFromHandSearch":
    case "deployFromTrashPayingCost":
    case "moveTopCardToChosenPosition":
      return true;
    case "moveWithinDeck":
      return call.target.kind === "named";
    default:
      return false;
  }
}

function specPrimitives(spec: EffectSpec): PrimitiveCall[] {
  return [
    ...(spec.cost ?? []),
    ...(spec.condition?.then ?? []),
    ...(spec.condition?.else ?? []),
    ...(spec.condition2?.then ?? []),
    ...(spec.condition2?.else ?? []),
    ...spec.actions,
  ];
}

export function callsChoicePrimitive(calls: PrimitiveCall[]): ChoicePrimitive | undefined {
  return calls.find(isChoicePrimitive);
}

export function callsNeedChoice(calls: PrimitiveCall[]): boolean {
  return callsChoicePrimitive(calls) !== undefined;
}

export function specChoicePrimitive(spec: EffectSpec): ChoicePrimitive | undefined {
  return specPrimitives(spec).find(isChoicePrimitive);
}

/** TODAS as primitivas de escolha do spec (ST02-015 tem 2 `moveWithinDeck` = 1 reordenação). */
export function specChoicePrimitives(spec: EffectSpec): ChoicePrimitive[] {
  return specPrimitives(spec).filter(isChoicePrimitive);
}

/** `true` se o spec consome uma escolha de carta / enum (ver `specChoicePrimitive`). */
export function specNeedsChoice(spec: EffectSpec): boolean {
  return specChoicePrimitive(spec) !== undefined;
}

/**
 * Retorna as chamadas ativas de um EffectSpec considerando a avaliação dinâmica
 * de sua condição (se houver) no contexto atual.
 */
export function specActiveCalls(
  spec: EffectSpec,
  ctx: EffectContext,
  predicateResolver?: PredicateResolver,
): PrimitiveCall[] {
  const calls: PrimitiveCall[] = [...(spec.actions ?? [])];
  if (spec.condition) {
    if (predicateResolver) {
      const passes = predicateResolver(spec.condition.predicate, ctx);
      if (passes) {
        calls.push(...spec.condition.then);
      } else if (spec.condition.else) {
        calls.push(...spec.condition.else);
      }
    } else {
      // Sem resolver fornecido, assume a cláusula then
      calls.push(...spec.condition.then);
    }
  }
  return calls;
}

/**
 * IDs de carta elegíveis pra o `discardNamed` de um spec: a mão atual de
 * `player` MAIS as cartas que serão compradas por `draw` ANTES do
 * `discardNamed` (ST04-002 "Draw 1. Then, discard 1." — dá pra descartar a
 * recém-comprada) MAIS as que um `moveZone` (toZone "hand") com alvo nomeado
 * IMPLÍCITO devolve à mão antes do `discardNamed` (GD01-005 "Return this
 * Unit's paired Pilot to its owner's hand. Then, discard 1." — `implicitTargets`
 * vem de `AbilityQueueEntry.implicitTargets`, ver `DestroyedInBattle.formerPairedPilotId`).
 * A ordem de ambos é determinística e o estado não muda entre montar a fila e
 * resolver.
 */
export function discardCandidateHandIds(
  spec: EffectSpec,
  state: GameState,
  player: PlayerId,
  implicitTargets?: Record<string, string[]>,
  /** chamadas ativas de `specActiveCalls` (actions + ramo da condição) — sem elas, só `actions` é olhado */
  activeCalls?: PrimitiveCall[],
): string[] {
  const hand = state.players[player].hand.map((c) => c.instanceId);
  let drawn = 0;
  const movedToHand: string[] = [];
  // ordem de execução de `resolveEffectSpec`: custo → ramo da condição → actions (E5 — a
  // compra dentro de `condition.then` antes do descarte era ignorada)
  const branch = activeCalls ? activeCalls.slice(spec.actions.length) : [];
  const ordered = [...(spec.cost ?? []), ...branch, ...spec.actions];
  for (const call of ordered) {
    if (call.op === "draw") drawn += call.n;
    if (call.op === "moveZone" && call.toZone === "hand" && call.target.kind === "named" && implicitTargets?.[call.target.name]) {
      movedToHand.push(...implicitTargets[call.target.name]);
    }
    if (call.op === "discardNamed") break;
  }
  const deckIds = state.players[player].deck.slice(0, Math.min(drawn, state.players[player].deck.length)).map((c) => c.instanceId);
  return [...hand, ...deckIds, ...movedToHand];
}

export function resolveEffectSpec(spec: EffectSpec, ctx: EffectContext, resolvePredicate?: PredicateResolver): GameEvent[] {
  const events: GameEvent[] = [];
  if (spec.cost) events.push(...compileActions(spec.cost, ctx));

  if (spec.condition) {
    if (!resolvePredicate) {
      throw new Error(`EffectSpec "${spec.id}" tem condição mas nenhum PredicateResolver foi passado`);
    }
    const result = resolvePredicate(spec.condition.predicate, ctx);
    events.push(...compileActions(result ? spec.condition.then : spec.condition.else ?? [], ctx));
  }

  if (spec.condition2) {
    if (!resolvePredicate) {
      throw new Error(`EffectSpec "${spec.id}" tem condition2 mas nenhum PredicateResolver foi passado`);
    }
    const result2 = resolvePredicate(spec.condition2.predicate, ctx);
    events.push(...compileActions(result2 ? spec.condition2.then : spec.condition2.else ?? [], ctx));
  }

  events.push(...compileActions(spec.actions, ctx));
  return events;
}

// re-exportado por conveniência pra quem só quer inspecionar dono/zona de um alvo antes de montar uma primitiva
export { findCard, findCardOwner };
