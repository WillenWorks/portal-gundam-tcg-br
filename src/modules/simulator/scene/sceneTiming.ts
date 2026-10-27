/* Spec simulador-cadencia-de-mesa (P0): quanto tempo cada coisa leva na tela. A tabela é uma só — os componentes
 * tocam com estes números e o servidor usa os mesmos para saber quando a cena termina (o bot espera, o prazo de
 * decisão só começa a contar depois). A duração não depende de quem vê: a cena dura o tempo da visão mais longa
 * (a minha jogada eu não vejo de novo; o oponente vê), e as duas telas liberam a mesa no mesmo instante. */
import { PLAYER_IDS, type GameEvent, type Phase } from "../engine/types";
import { planChoreography, tempoFor, type Beat, type PendingAttack } from "./choreography";

/** ritmo da cena. "classic" = o ritmo de antes do #228 (ninguém espera a tela) — também é a reversão */
export type ScenePace = "cinematic" | "normal" | "classic";

export const SCENE_PACES: readonly ScenePace[] = ["cinematic", "normal", "classic"];

/** multiplica os tempos que seguram a fila (anúncio, entrada, efeitos, saídas); 0 = sem espera */
export const SCENE_PACE_FACTOR: Record<ScenePace, number> = { cinematic: 1, normal: 0.7, classic: 0 };

export function isScenePace(value: unknown): value is ScenePace {
  return typeof value === "string" && (SCENE_PACES as readonly string[]).includes(value);
}

/** o ritmo mais lento entre os jogadores: ninguém tem a cena cortada pela pressa do outro */
export function slowestPace(paces: readonly (ScenePace | undefined)[]): ScenePace {
  const known = paces.map((p) => p ?? "cinematic");
  if (known.length === 0) return "cinematic";
  return known.reduce((slow, p) => (SCENE_PACE_FACTOR[p] > SCENE_PACE_FACTOR[slow] ? p : slow));
}

/** ms base (antes da velocidade de animação do jogador) */
export const SCENE_MS = {
  /** `ActivationAnnouncement`: sobe, segura, sai */
  announce: { rise: 280, hold: 760, out: 240 },
  /** entrada em campo usa o mesmo componente, com espera menor (ritmo rápido) */
  deployHold: 420,
  /**
   * P3 — carta jogada da mão (`PlayCardStage`): sobe à mostra, os recursos pagos giram um a um, e ela cai no campo
   * (suave até Lv 4, pesada do Lv 5 em diante, com tremor) ou é usada no centro (Command)
   */
  play: { rise: 420, hold: 380, payPerCard: 170, paySettle: 450, drop: 420, dropHeavy: 520, land: 500, landHeavy: 700, used: 520 },
  /** `CommandCastAnimation` */
  command: { rise: 320, hold: 700, fly: 360, settle: 160 },
  /** compra (P2, `CardTravel`): a minha sai do deck, vem ao centro, vira, fica à mostra e pousa à direita da mão; a do
   *  oponente vai direto do deck dele para a mão dele — a cena dura o mesmo nas duas telas */
  draw: { rise: 380, flip: 300, hold: 500, land: 380 },
  /** Start Phase: banner sai, e as cartas descansadas giram de volta para a vertical */
  unrest: 600,
  /** Resource Phase: a carta do deck de recursos vira e pousa na área de recursos */
  resource: 700,
  /** `executeAttackStrike`: avança, golpe, volta */
  strike: { advance: 260, hit: 220, back: 280 },
  /** cues do que um efeito fez (o número de dano sobe sobre o HP; o HP novo aparece no fim) */
  effects: 700,
  /** cartas saindo para a lixeira/exílio (descarte, Command usada…) */
  departure: 520,
  /**
   * P4 — combate: o atacante deita e a linha vai ao alvo; o bloqueador deita e a linha muda; a Unit destruída quebra
   * e é arrastada à lixeira; cada shield quebrada vai ao centro, vira para os dois verem e cai na lixeira
   */
  combat: {
    declare: { rest: 450, line: 450 },
    block: 750,
    destroy: { crack: 320, drag: 460 },
    shield: { fly: 420, flip: 400, hold: 600, toTrash: 420 },
  },
  /** `PhaseAnnouncementBanner` */
  banner: 750,
  /** `BurstRevealStage`: escudo voa, vira, segura */
  burstReveal: { fly: 420, flip: 500, hold: 550 },
  /** o modal da escolha espera a minha carta pousar */
  modalHold: 420,
  /** folga para a rede e o React aplicarem a visão */
  margin: 200,
  /** abertura da partida (P1): moeda → decks → embaralhar → 5 cartas → mulligan → escudos → EX → turno 1 */
  opening: {
    /** mesa aparece antes da moeda */
    fieldReady: 650,
    /** `CoinToss`: parada no lado inicial, sobe girando, cai girando, assenta, mostra quem começa */
    coin: { idle: 350, up: 850, down: 850, settle: 300, result: 1500 },
    /** destaque do lado de quem começa */
    fieldHighlight: 1250,
    /** decks pousando nas zonas */
    deckAppear: 650,
    shuffle: 1300,
    dealStagger: 90,
    flight: 450,
    handRevealHold: 340,
    /** mão revelada antes da decisão */
    handRevealed: 550,
    /** mulligan: a mão volta ao deck antes de embaralhar */
    mulliganReturn: 340,
    shieldStagger: 160,
    shieldStackHold: 250,
    /** EX Base (e EX Resource de quem joga em 2º) aparecendo */
    exReveal: 1000,
  },
} as const;

/** banners da virada de turno: "seu turno / turno do oponente" + recuperação + compra + recurso + principal */
const TURN_START_BANNERS = 5;

export function drawMs(): number {
  return SCENE_MS.draw.rise + SCENE_MS.draw.flip + SCENE_MS.draw.hold + SCENE_MS.draw.land;
}

/** começo de turno (P2): cada banner sai e só então a fase acontece — desvirar, comprar, pôr o recurso */
export function turnStartMs(): number {
  return TURN_START_BANNERS * SCENE_MS.banner + SCENE_MS.unrest + drawMs() + SCENE_MS.resource;
}

const O = SCENE_MS.opening;

export function coinTossMs(): number {
  return O.coin.idle + O.coin.up + O.coin.down + O.coin.settle + O.coin.result;
}

/** 5 cartas saindo do deck para a mão, uma atrás da outra, e o instante de olhar para elas */
export function dealHandMs(): number {
  return 4 * O.dealStagger + O.flight + O.handRevealHold;
}

export function dealShieldsMs(): number {
  return 6 * O.shieldStagger + O.flight + O.shieldStackHold;
}

/** da mesa vazia até as duas mãos reveladas (a 1ª decisão de mulligan começa aqui) */
export function openingIntroMs(): number {
  return O.fieldReady + coinTossMs() + O.fieldHighlight + O.deckAppear + O.shuffle + dealHandMs() + O.handRevealed;
}

/** a mão volta, o deck embaralha e 5 novas saem (visto pelos dois) */
export function mulliganRedrawMs(): number {
  return O.mulliganReturn + O.shuffle + dealHandMs();
}

/** fim do mulligan até a Main Phase do turno 1: escudos, EX, banners do turno */
export function setupFinishMs(): number {
  return dealShieldsMs() + O.exReveal + turnStartMs();
}

/** tempos cuja espera segue o `tempo` do lote (e o ritmo); a carta jogada, o combate e a compra têm duração própria */
const TEMPO_SCALED = new Set<Beat["kind"]>(["announce", "effects", "departure"]);

export function shieldRevealMs(): number {
  const sh = SCENE_MS.combat.shield;
  return sh.fly + sh.flip + sh.hold + sh.toTrash;
}

export function destroyMs(): number {
  return SCENE_MS.combat.destroy.crack + SCENE_MS.combat.destroy.drag;
}

/** Unit do Lv 5 em diante cai pesada na mesa (com tremor); até o Lv 4, pousa suave */
export function landsHeavy(level: number | undefined): boolean {
  return (level ?? 0) >= 5;
}

/** os recursos pagos giram um a um; o último ainda termina de girar */
export function payMs(count: number): number {
  return count > 0 ? SCENE_MS.play.paySettle + (count - 1) * SCENE_MS.play.payPerCard : 0;
}

/** nível da carta pelo id (a tela e o servidor conhecem as definições); sem ele, a conta usa o pouso suave */
export type LevelOf = (instanceId: string) => number | undefined;

export function beatBaseMs(beat: Beat, levelOf?: LevelOf): number {
  switch (beat.kind) {
    case "announce":
      return SCENE_MS.announce.rise + SCENE_MS.announce.hold + SCENE_MS.announce.out + payMs(beat.paid.length);
    case "play": {
      const p = SCENE_MS.play;
      const shown = p.rise + p.hold + payMs(beat.paid.length);
      if (beat.as === "command") return shown + p.used;
      if (beat.as === "unit" && landsHeavy(levelOf?.(beat.instanceId))) return shown + p.dropHeavy + p.landHeavy;
      return shown + p.drop + p.land;
    }
    case "draw":
      return drawMs();
    case "strike":
      return SCENE_MS.strike.advance + SCENE_MS.strike.hit + SCENE_MS.strike.back;
    case "effects":
      return SCENE_MS.effects;
    case "declare":
      return (beat.rests ? SCENE_MS.combat.declare.rest : 0) + SCENE_MS.combat.declare.line;
    case "block":
      return SCENE_MS.combat.block;
    case "departure":
      if (beat.shieldsOf) return (beat.count ?? 0) * shieldRevealMs();
      return beat.destroyed ? destroyMs() : SCENE_MS.departure;
  }
}

/** quanto os tempos de uma visão seguram a fila, já com o `tempo` do lote e o ritmo */
export function beatsDurationMs(beats: readonly Beat[], pace: ScenePace, levelOf?: LevelOf): number {
  const factor = SCENE_PACE_FACTOR[pace];
  const tempo = tempoFor(beats) * factor;
  return beats.reduce((ms, beat) => {
    const scaled = TEMPO_SCALED.has(beat.kind) && !(beat.kind === "departure" && beat.shieldsOf);
    return ms + beatBaseMs(beat, levelOf) * (scaled ? tempo : 1);
  }, 0);
}

export interface SceneInput {
  /** eventos desde a última transmissão */
  events: readonly GameEvent[];
  /** combate aberto antes do lote cujo golpe ainda não tocou */
  pendingAttack: PendingAttack | null;
  /** fase em que o lote começa */
  phase: Phase;
  /** recursos em jogo no começo do lote (pagar custo não é efeito) */
  resourceIds?: ReadonlySet<string>;
  /** o lote começa ainda na preparação (mulligan): a abertura tem coreografia própria */
  fromSetup: boolean;
  /** depois do lote alguém decide um 【Burst】: o escudo é revelado antes do modal */
  endsWithBurstDecision: boolean;
  /** depois do lote há escolha de efeito pendente para quem acabou de pôr uma carta em campo */
  endsWithDeployChoice: boolean;
  pace: ScenePace;
  /** nível das cartas jogadas (pouso pesado dura mais) */
  levelOf?: LevelOf;
}

/**
 * Quanto a cena deste lote dura na tela (ms) e o combate que segue aberto para o próximo. 0 = nada a esperar
 * (ritmo "classic", abertura, lote sem nada visível).
 */
export function sceneDurationMs(input: SceneInput): { durationMs: number; pendingAttack: PendingAttack | null } {
  let pendingAttack = input.pendingAttack;
  let longest = 0;
  for (const viewerSeat of PLAYER_IDS) {
    const plan = planChoreography({
      events: input.events,
      viewerSeat,
      pendingAttack: input.pendingAttack,
      phase: input.phase,
      resourceIds: input.resourceIds,
    });
    pendingAttack = plan.pendingAttack;
    longest = Math.max(longest, beatsDurationMs(plan.beats, input.pace, input.levelOf));
  }
  if (input.pace === "classic" || input.fromSetup) return { durationMs: 0, pendingAttack };

  let ms = longest;
  if (input.events.some((e) => e.type === "TURN_CHANGE")) {
    // o fim do turno anterior: "fim de turno", mais "fase de ações" se ela não foi anunciada antes do lote
    const endBanners = input.phase === "end" ? 1 : 2;
    ms += endBanners * SCENE_MS.banner + turnStartMs();
  }
  if (input.endsWithBurstDecision) ms += SCENE_MS.burstReveal.fly + SCENE_MS.burstReveal.flip + SCENE_MS.burstReveal.hold;
  if (input.endsWithDeployChoice) ms += SCENE_MS.modalHold;
  return { durationMs: ms > 0 ? Math.round(ms + SCENE_MS.margin) : 0, pendingAttack };
}
