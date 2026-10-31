/* Camada 1 da fase de assertividade, categoria Reaction ("when this Unit destroys…", "at the end of your turn", "when
 * one of your Units is deployed"…): para CADA carta cujo evento dá para provocar pelo caminho do jogador, o evento sai
 * de jogadas legais (ataque, fim do turno, pareamento, deploy, Command) e o controle é a mesma sequência sem a
 * Reaction da carta. Eventos que dependem de um efeito específico ficam numa lista cobrada. */
import { describe, expect, it } from "vitest";
import { createGame } from "./setup";
import { advanceToMainPhase } from "./phases";
import { applyPlayerAction, type PlayerAction } from "./actions";
import { actionOwner, enumerateLegalActions } from "./legalActions";
import { placeCard } from "./__testkit__/cardHarness";
import { fingerprint, partnerFor, richBoard, scenarioOpts, settleDecisions, trashMaterialFor } from "./__testkit__/cardScenario";
import type { EffectSpec, ReactionEvent } from "./effectSpec";
import type { CardDef, GameState, PlayerId } from "./types";
import { buildSt01DeckList, ST01_CARD_DEFS } from "../fixtures/st01Deck";
import { buildSt02DeckList } from "../fixtures/st02Deck";
import { ALL_EFFECT_SPECS, defaultPredicateResolver, defaultTargetFilterResolver } from "../content";
import { ALL_CARD_DEFS } from "../content/allCardDefs";

const REACTION_SPECS = ALL_EFFECT_SPECS.filter((s) => s.trigger.startsWith("Reaction:") && s.reaction);
const TRASH_MATERIAL = trashMaterialFor(REACTION_SPECS);
const RESOURCE: CardDef = { code: "CA-RES", nameEn: "Resource", cardType: "RESOURCE", color: "colorless" };
/** Unit inimiga descansada que morre com qualquer dano */
const WEAK: CardDef = { ...ST01_CARD_DEFS.GM, code: "CA-WEAK", nameEn: "Weak", level: 1, ap: 0, hp: 1, traits: [] };
const PLAIN_COMMAND = ALL_CARD_DEFS["ST01-013"]; // 【Main】Choose 1 friendly Unit. It recovers 3 HP.

const SCENARIO_EVENTS: ReactionEvent[] = [
  "destroyedEnemyInBattle",
  "destroyedEnemyWithDamage",
  "battleDamageToEnemyUnit",
  "destroyedShieldInBattle",
  "attack",
  "endOfTurn",
  "pilotPaired",
  "unitLinked",
  "unitDeployed",
  "commandActivated",
];
const covered = (s: EffectSpec) => SCENARIO_EVENTS.includes(s.reaction!.event) && s.reaction!.turn !== "opponents";
const CARDS = [...new Set(REACTION_SPECS.filter(covered).map((s) => s.cardCode))].sort().filter((c) => ALL_CARD_DEFS[c]);
const SEM_CENARIO = [...new Set(REACTION_SPECS.filter((s) => !covered(s)).map((s) => s.cardCode))].filter((c) => !CARDS.includes(c)).sort();

function apply(state: GameState, seat: PlayerId, action: PlayerAction, specs: EffectSpec[]): GameState {
  return settleDecisions(applyPlayerAction(state, seat, action, specs, defaultPredicateResolver, defaultTargetFilterResolver), specs);
}

const legal = (state: GameState, seat: PlayerId, specs: EffectSpec[]) => enumerateLegalActions(state, seat, specs, scenarioOpts);

/** passes e decisões pela jogada legal até `done` */
function passUntil(state: GameState, specs: EffectSpec[], done: (s: GameState) => boolean): GameState {
  let next = state;
  for (let guard = 0; guard < 60 && !done(next) && !next.gameOver; guard++) {
    const seat = actionOwner(next);
    if (!seat) break;
    const pass = legal(next, seat, specs).find((a) => a.kind === "skipBlock" || a.kind === "passAction" || a.kind === "passEndPhaseAction");
    if (!pass) break;
    next = apply(next, seat, pass, specs);
  }
  return next;
}

/** Unit inimiga descansada que aguenta o golpe ("when this Unit deals battle damage to an enemy Unit, destroy it") */
const TOUGH: CardDef = { ...WEAK, code: "CA-TOUGH", nameEn: "Tough", level: 3, hp: 20 };

/** o `subjectFilter` lido como pedidos ao ator: trait (também dentro de `or(…)`), cor, keyword, nível */
function subjectWants(spec: EffectSpec) {
  const raw = spec.reaction?.subjectFilter ?? "";
  const parts = raw.replace(/^or\((.*)\)$/, "$1").split(/[;|]/);
  const value = (key: string) => parts.find((p) => p.startsWith(`${key}:`))?.slice(key.length + 1);
  const traits = parts.flatMap((p) => (p.startsWith("trait:") ? [p.slice(6)] : p.startsWith("anyTrait:") ? p.slice(9).split(",").slice(0, 1) : []));
  const minLevel = parts.map((p) => /^level>=(\d+)$/.exec(p)).find(Boolean);
  return {
    traits,
    color: value("color") as CardDef["color"] | undefined,
    keyword: value("hasKeyword"),
    level: minLevel ? Number(minLevel[1]) : undefined,
    pairedUnitColor: value("pairedUnitColor") as CardDef["color"] | undefined,
    pairedUnitLinkTrait: value("pairedUnitLinkWithTrait"),
  };
}

/** quem provoca o evento: com o que o `subjectFilter` pede ("friendly (Clan) Unit"), forte o bastante para matar */
function actorFor(spec: EffectSpec): CardDef {
  const w = subjectWants(spec);
  return {
    ...ST01_CARD_DEFS.GM,
    code: "CA-HERO",
    nameEn: "Hero",
    level: w.level ?? 4,
    ap: 5,
    hp: 5,
    traits: w.traits,
    ...(w.color ? { color: w.color } : {}),
    ...(w.keyword ? { effectKeywords: [w.keyword], keywordTags: [w.keyword] } : {}),
  };
}

interface Scenario {
  state: GameState;
  run: (specs: EffectSpec[]) => GameState | null;
}

function scenario(code: string): Scenario | null {
  const def = ALL_CARD_DEFS[code];
  const own = REACTION_SPECS.filter((s) => s.cardCode === code && covered(s));
  const spec = own[0];
  const reaction = spec.reaction!;
  let state = advanceToMainPhase(createGame(buildSt01DeckList(), buildSt02DeckList(), { seed: 7, firstPlayer: "A" }));
  for (let i = 0; i < 10; i++) placeCard(state, "A", RESOURCE, "resourceArea");
  richBoard(state, "A", TRASH_MATERIAL);

  // a carta em jogo; num Piloto, "this Unit" é a Unit pareada com ele
  const partner = partnerFor(own, def);
  if (reaction.pairedPilotMinLevel) partner.pilot = { ...partner.pilot, level: reaction.pairedPilotMinLevel };
  let selfUnitId: string | undefined;
  if (def.cardType === "BASE") {
    state.players.A.baseSection = [];
    placeCard(state, "A", def, "baseSection");
  } else {
    const isUnit = def.cardType === "UNIT";
    selfUnitId = placeCard(state, "A", isUnit ? def : { ...partner.unit, ap: 5, hp: 5 }, "battleArea");
    const wantsPilot = !isUnit || own.some((s) => s.duringPair || s.duringLink || s.reaction?.pairedPilotMinLevel);
    if (wantsPilot) {
      const pilotId = placeCard(state, "A", isUnit ? partner.pilot : def, "hand");
      const pair = legal(state, "A", ALL_EFFECT_SPECS).find(
        (a) => a.kind === "deployCard" && a.cardInstanceId === pilotId && "pairWithUnitId" in a && a.pairWithUnitId === selfUnitId,
      );
      if (!pair) return null;
      state = apply(state, "A", pair, ALL_EFFECT_SPECS);
    }
  }
  const actorId = reaction.subject === "self" ? selfUnitId : placeCard(state, "A", actorFor(spec), "battleArea");
  if (!actorId && ["destroyedEnemyInBattle", "destroyedEnemyWithDamage", "battleDamageToEnemyUnit", "destroyedShieldInBattle", "attack"].includes(reaction.event)) {
    return null;
  }

  const attackThen = (target: "player" | string) => (specs: EffectSpec[]) => {
    const attack = legal(state, "A", specs).find(
      (a) => a.kind === "declareAttack" && a.attackerId === actorId && (target === "player" ? a.target === "player" : typeof a.target === "object" && a.target.unitId === target),
    );
    return attack ? passUntil(apply(state, "A", attack, specs), specs, (s) => !s.combat) : null;
  };

  switch (reaction.event) {
    case "destroyedEnemyInBattle":
    case "destroyedEnemyWithDamage": {
      const weakId = placeCard(state, "B", WEAK, "battleArea", { rested: true });
      return { state, run: attackThen(weakId) };
    }
    case "battleDamageToEnemyUnit": {
      const toughId = placeCard(state, "B", TOUGH, "battleArea", { rested: true });
      return { state, run: attackThen(toughId) };
    }
    case "destroyedShieldInBattle":
      state.players.B.baseSection = [];
      return { state, run: attackThen("player") };
    case "attack":
      return { state, run: attackThen("player") };
    case "endOfTurn":
      return {
        state,
        run: (specs) => passUntil(apply(state, "A", { kind: "finishTurn" }, specs), specs, (s) => s.activePlayer === "B"),
      };
    case "pilotPaired":
    case "unitLinked": {
      // "When you pair a (Cyber-Newtype) Pilot with one of your blue Units" / "When a friendly (Phantom Pain) Unit links"
      const w = subjectWants(spec);
      const pilotTraits = reaction.event === "pilotPaired" && !w.pairedUnitLinkTrait ? w.traits : [];
      const pilot: CardDef = { code: "CA-PILOT", nameEn: "Link Pilot", cardType: "PILOT", color: "colorless", level: 1, cost: 1, ap: 1, hp: 1, traits: pilotTraits };
      const unitDef: CardDef = {
        ...actorFor(spec),
        traits: pilotTraits.length ? [] : w.pairedUnitLinkTrait ? [w.pairedUnitLinkTrait] : w.traits,
        ...(w.pairedUnitColor ? { color: w.pairedUnitColor } : {}),
        link: { kind: "pilotName", values: ["Link Pilot"] },
      };
      const unitId = placeCard(state, "A", unitDef, "battleArea");
      const pilotId = placeCard(state, "A", pilot, "hand");
      return {
        state,
        run: (specs) => {
          const pair = legal(state, "A", specs).find((a) => a.kind === "deployCard" && a.cardInstanceId === pilotId && "pairWithUnitId" in a && a.pairWithUnitId === unitId);
          return pair ? apply(state, "A", pair, specs) : null;
        },
      };
    }
    case "unitDeployed": {
      const unitId = placeCard(state, "A", actorFor(spec), "hand");
      return {
        state,
        run: (specs) => {
          const deploy = legal(state, "A", specs).find((a) => a.kind === "deployCard" && a.cardInstanceId === unitId && !("pairWithUnitId" in a && a.pairWithUnitId));
          return deploy ? apply(state, "A", deploy, specs) : null;
        },
      };
    }
    case "commandActivated": {
      const cmdId = placeCard(state, "A", PLAIN_COMMAND, "hand");
      return {
        state,
        run: (specs) => {
          const play = legal(state, "A", specs).find((a) => a.kind === "playCommand" && a.cardInstanceId === cmdId);
          return play ? apply(state, "A", play, specs) : null;
        },
      };
    }
    default:
      return null;
  }
}

/* Exceções deste tabuleiro, por motivo. As listas são cobradas. */
const SEM_CENARIO_ESPERADO: string[] = [
  // dano / descanso / ativação / destruição POR EFEITO, pagamento de efeito de Unit, EX Resource, compra por efeito,
  // ou só no turno do oponente — o evento depende de uma carta de efeito específica
  "GD03-038", "GD03-053", "GD03-060", "GD03-095", "GD03-098", "GD03-128", "GD03-129", "GD04-018", "GD04-041", "GD04-069",
  "GD04-100", "GD04-124", "GD04-126", "GD04-129", "GD05-018", "GD05-054", "GD05-101", "ST08-011", "ST13-012",
];
const NAO_PROVOCADAS: string[] = [];
const SEM_RASTRO_NO_TABULEIRO: string[] = [
  // "if this Unit is rested" / "pareada neste turno" (During Link) — a carta não está assim no evento
  "EB01-003", "EB01-028", "GD03-069",
  // "N or more (CB) cards in your trash" / "(CB) Pilot in play"
  "GD03-049", "ST07-001", "GD03-052",
  // Command paga com EX Resource (Dawn of Fold / Academy)
  "GD04-020", "GD04-021", "GD04-085",
  // Link Units / Piloto (Cyber-Newtype) que o tabuleiro não tem
  "GD04-042", "GD05-070",
  // "this Unit recovers 2 HP" sem dano
  "GD05-085",
  // W13a — "(Special Move) Command" que o tabuleiro não joga
  "GD06-071",
];

describe(`Reaction gerado — ${CARDS.length} cartas com evento provocável pelo jogador`, () => {
  it("as Reactions sem cenário (evento que depende de um efeito específico) são as conhecidas", () => {
    expect(SEM_CENARIO).toEqual([...SEM_CENARIO_ESPERADO].sort());
  });

  it("a favor: o evento provocado pela jogada legal dispara a Reaction e ela muda o tabuleiro", () => {
    const naoProvocadas: string[] = [];
    const semRastro: string[] = [];
    const falhas: string[] = [];
    for (const code of CARDS) {
      const sc = scenario(code);
      if (!sc) {
        naoProvocadas.push(code);
        continue;
      }
      const without = ALL_EFFECT_SPECS.filter((s) => !(s.cardCode === code && s.trigger.startsWith("Reaction:")));
      try {
        const real = sc.run(ALL_EFFECT_SPECS);
        const control = sc.run(without);
        if (!real || !control) {
          naoProvocadas.push(code);
          continue;
        }
        if (real.pendingDecision.A || real.pendingDecision.B) falhas.push(`${code}: decisão ficou pendente`);
        else if (fingerprint(real) === fingerprint(control)) semRastro.push(code);
      } catch (err) {
        falhas.push(`${code}: exceção ${(err as Error).message}`);
      }
    }
    expect(falhas).toEqual([]);
    expect(naoProvocadas.sort()).toEqual([...NAO_PROVOCADAS].sort());
    expect(semRastro.sort()).toEqual([...SEM_RASTRO_NO_TABULEIRO].sort());
  }, 180_000);
});
