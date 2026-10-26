/* Spec simulador-ritmo-de-resolucao: o ritmo da partida na tela. Os eventos de uma visão (`MatchView.eventsSince`)
 * viram "tempos" tocados um de cada vez, na ordem do motor — a carta que entrou, o anúncio da habilidade, o que ela
 * fez (dano, buff, compra), as cartas que saíram, o golpe do combate. Mesma régua para o jogador e para o bot: as
 * duas jogadas chegam pela mesma fila de visões e tocam o mesmo plano. Puro/testável — a página só executa.
 *
 * O caminho antigo (`planAnimations` + todos os cues de uma vez) continua em `timelinePlayback.ts` e é o que roda com
 * o ritmo "rápido" (`getResolutionPacing() === "classic"`), que serve também de reversão sem deploy. */
import type { AttackTarget, GameEvent, Phase, PlayerId } from "../engine/types";
import type { PendingAttack } from "./timelinePlayback";

export type Beat =
  /** Unit/Base/Piloto entrando em campo — só quando há mais tempos depois (o anúncio do 【Deploy】 vem depois dela) */
  | { kind: "deploy"; player: PlayerId; instanceId: string; as: "unit" | "base" | "pilot" }
  /** Command jogada pelo oponente (a minha já tocou antes do envio, em `runAction`) */
  | { kind: "opponentCommand"; instanceId: string }
  /** habilidade resolvendo: 【Deploy】, 【Attack】, 【Activate】, 【Burst】 do oponente… */
  | { kind: "announce"; player: PlayerId; instanceId: string; trigger: string }
  | { kind: "draw"; player: PlayerId; instanceId: string | null }
  | { kind: "strike"; attackerId: string; target: AttackTarget; defendingPlayer: PlayerId }
  /** o que um efeito fez, mostrado junto (os cues do `EffectResolutionOverlay`) */
  | { kind: "effects"; events: GameEvent[] }
  /** cartas indo para a lixeira/exílio (`ids`) ou shields quebradas (`shieldsOf`/`count`: as do topo na visão anterior) */
  | { kind: "departure"; ids: string[]; shieldsOf?: PlayerId; count?: number };

/** eventos que o `EffectResolutionOverlay` sabe desenhar */
const CUE_EVENTS = new Set<GameEvent["type"]>([
  "DAMAGE_UNIT",
  "DAMAGE_BASE",
  "DAMAGE_SHIELD",
  "HEAL_UNIT",
  "DESTROY_CARD",
  "REMOVE_CARD_FROM_GAME",
  "REST_CARD",
  "SET_ACTIVE",
  "PAIR_CARDS",
  "BLOCK_DECLARED",
  "SET_CANNOT_ATTACK",
  "SET_CANNOT_ACTIVATE",
  "MARK_COMMAND_PAYMENT",
  "DRAW_CARD",
  "MODIFY_STAT",
  "GRANT_KEYWORD",
  "SPAWN_TOKEN",
]);

/** fases de estrutura do turno: o que acontece nelas já é contado pelos banners e pela compra da virada de turno */
const STRUCTURAL_PHASES = new Set<Phase>(["start", "draw", "resource"]);

/** acima disto num lote só (turno inteiro do bot), os tempos encurtam — decisão da spec simulador-animacao-pelo-log */
export const LONG_BATCH_BEATS = 8;
export const LONG_BATCH_TEMPO = 0.65;

export function tempoFor(beats: readonly Beat[]): number {
  return beats.length > LONG_BATCH_BEATS ? LONG_BATCH_TEMPO : 1;
}

/** quanto cada tempo segura a fila (ms, antes da velocidade do jogador); os de componente esperam o próprio `onDone` */
export const BEAT_HOLD_MS = { effects: 700, departure: 520 } as const;

export interface ChoreographyInput {
  events: readonly GameEvent[];
  viewerSeat: PlayerId;
  /** combate aberto numa visão anterior cujo golpe ainda não tocou */
  pendingAttack: PendingAttack | null;
  /** fase da visão anterior — o lote começa nela */
  phase: Phase;
  /** recursos em jogo (visão anterior): descansar/ativar recurso é pagamento, não efeito — não vira cue */
  resourceIds?: ReadonlySet<string>;
}

export function planChoreography({ events, viewerSeat, pendingAttack, phase: startPhase, resourceIds }: ChoreographyInput): {
  beats: Beat[];
  pendingAttack: PendingAttack | null;
} {
  const beats: Beat[] = [];
  let phase = startPhase;
  let attack = pendingAttack;
  /** dano/saídas do combate: tocam depois do golpe (no log vêm antes do fim do combate) */
  let heldForStrike: Beat[] = [];
  let cues: GameEvent[] = [];
  /** uma habilidade anunciada está resolvendo: o que vier é dela (toca na hora, mesmo dentro de combate) */
  let abilityOpen = false;
  /** jogada da própria mesa que ficou de fora porque nada vinha depois dela */
  const deploys: Beat[] = [];

  const holding = () => attack !== null && !abilityOpen;
  const push = (beat: Beat) => (holding() ? heldForStrike.push(beat) : beats.push(beat));
  const flushCues = () => {
    if (cues.length > 0) push({ kind: "effects", events: cues });
    cues = [];
  };
  const closeAbility = () => {
    flushCues();
    abilityOpen = false;
  };

  for (const event of events) {
    switch (event.type) {
      case "TURN_CHANGE":
      case "PHASE_CHANGE":
        closeAbility();
        if (event.type === "PHASE_CHANGE") phase = event.phase;
        break;
      case "COMBAT_STEP_CHANGE":
        // o efeito do Action Step terminou; o dano de batalha que vem é do combate
        closeAbility();
        break;
      case "CARD_PLAYED":
        closeAbility();
        if (event.as === "command") {
          if (event.player !== viewerSeat) beats.push({ kind: "opponentCommand", instanceId: event.instanceId });
          // a Command é a própria habilidade: o que vier depois é dela
          abilityOpen = true;
        } else {
          const beat: Beat = { kind: "deploy", player: event.player, instanceId: event.instanceId, as: event.as };
          beats.push(beat);
          if (event.player === viewerSeat) deploys.push(beat);
        }
        break;
      case "ABILITY_ACTIVATED":
        closeAbility();
        // o 【Burst】 do próprio assento já teve a revelação e o modal; o do oponente é anunciado como os outros
        if (!(event.trigger === "Burst" && event.player === viewerSeat)) {
          beats.push({ kind: "announce", player: event.player, instanceId: event.instanceId, trigger: event.trigger });
        }
        abilityOpen = true;
        break;
      case "ATTACK_DECLARED":
      case "BEGIN_DAMAGE_ONLY_BATTLE":
        closeAbility();
        attack = {
          attackerId: event.attackerId,
          target: event.type === "ATTACK_DECLARED" ? event.target : { unitId: event.targetId },
          defendingPlayer: event.defendingPlayer,
        };
        break;
      case "BLOCK_DECLARED":
        flushCues();
        // o bloqueio é visto na hora (a seta muda), não depois do golpe
        beats.push({ kind: "effects", events: [event] });
        if (attack) attack = { ...attack, target: event.newTarget };
        break;
      case "ATTACK_TARGET_CHANGED":
        if (attack) attack = { ...attack, target: { unitId: event.unitId } };
        break;
      case "COMBAT_ENDED":
        closeAbility();
        if (attack) beats.push({ kind: "strike", ...attack });
        beats.push(...heldForStrike);
        heldForStrike = [];
        attack = null;
        break;
      case "DRAW_CARD":
        if (event.from === "deck" && phase !== "draw") {
          flushCues();
          push({ kind: "draw", player: event.player, instanceId: event.instanceId });
        } else if (abilityOpen || !STRUCTURAL_PHASES.has(phase)) {
          cues.push(event);
        }
        break;
      case "DESTROY_CARD":
      case "REMOVE_CARD_FROM_GAME":
        cues.push(event);
        flushCues();
        push({ kind: "departure", ids: [event.instanceId] });
        break;
      case "MOVE_CARD":
        if (event.toZone === "trash" || event.toZone === "exile") {
          flushCues();
          push({ kind: "departure", ids: [event.instanceId] });
        }
        break;
      case "DISCARD_TO_HAND_LIMIT":
        flushCues();
        push({ kind: "departure", ids: event.instanceIds });
        break;
      case "DAMAGE_SHIELD":
        if (event.count <= 0) break;
        cues.push(event);
        flushCues();
        push({ kind: "departure", ids: [], shieldsOf: event.player, count: event.count });
        break;
      case "REST_CARD":
      case "SET_ACTIVE":
        // pagamento de custo e o próprio atacante descansando ao atacar não são efeito
        if (resourceIds?.has(event.instanceId) || event.instanceId === attack?.attackerId) break;
        if (abilityOpen || !STRUCTURAL_PHASES.has(phase)) cues.push(event);
        break;
      default:
        if (CUE_EVENTS.has(event.type) && (abilityOpen || !STRUCTURAL_PHASES.has(phase))) cues.push(event);
        break;
    }
  }
  flushCues();
  // o combate segue na próxima visão (a decisão do 【Burst】 parou o motor no meio do Damage Step), mas o dano já
  // saiu neste lote: o golpe toca agora, antes do dano, e não toca de novo quando o combate terminar
  if (attack && heldForStrike.some(isDamageBeat)) {
    beats.push({ kind: "strike", ...attack });
    attack = null;
  }
  beats.push(...heldForStrike);
  return { beats: withoutLoneOwnDeploys(beats, deploys), pendingAttack: attack };
}

function isDamageBeat(beat: Beat): boolean {
  if (beat.kind === "departure") return true;
  return beat.kind === "effects" && beat.events.some((e) => e.type === "DAMAGE_UNIT" || e.type === "DAMAGE_BASE" || e.type === "DAMAGE_SHIELD");
}

/**
 * A minha jogada eu já vi (cliquei, a carta pousa quando a visão aplica). O tempo de "deploy" dela só existe para a
 * ordem ficar certa quando algo vem depois dela no lote — a Unit entra antes do anúncio do 【Deploy】 dela.
 */
function withoutLoneOwnDeploys(beats: Beat[], ownDeploys: Beat[]): Beat[] {
  return beats.filter((beat) => !ownDeploys.includes(beat) || beats.indexOf(beat) < beats.length - 1);
}

/** o lote tem uma jogada de carta (Unit/Base/Piloto) do próprio assento — o modal de escolha espera ela pousar */
export function hasOwnDeploy(events: readonly GameEvent[], viewerSeat: PlayerId): boolean {
  return events.some((e) => e.type === "CARD_PLAYED" && e.player === viewerSeat && e.as !== "command");
}

/** rótulo do gatilho como na carta — o texto das reações/atrasados não cabe num selo, vira "Efeito" */
export function triggerLabel(trigger: string): { pt: string; en: string } {
  const bracket: Record<string, string> = {
    Deploy: "Deploy",
    Attack: "Attack",
    Destroyed: "Destroyed",
    Burst: "Burst",
    "When Paired": "When Paired",
    "When Linked": "When Linked",
    "Activate·Main": "Activate･Main",
    "Activate·Action": "Activate･Action",
  };
  const known = bracket[trigger];
  if (known) return { pt: `【${known}】`, en: `【${known}】` };
  return { pt: "Efeito", en: "Effect" };
}
