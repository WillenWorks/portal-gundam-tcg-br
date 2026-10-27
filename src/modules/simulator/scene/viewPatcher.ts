/* Spec simulador-cadencia-de-mesa (P0): a mesa entre um tempo e outro. A tela recebe só o "antes" (a visão anterior) e
 * o "depois" (a visão do servidor); para a Unit ficar com 2 de HP e SÓ DEPOIS o segundo efeito acontecer, cada tempo
 * que termina revela na mesa o que ELE fez, trazendo as cartas que ele tocou do "depois" para a mesa mostrada.
 *
 * Não reimplementa regra: a carta revelada é a do "depois" (já redigida para quem vê), só que sem adiantar o que tempos
 * seguintes ainda vão fazer nela (dano a mais, descansar). No fim da cena a visão do servidor substitui tudo — um erro
 * aqui dura no máximo até o fim da cena. Puro/testável. */
import type { CardInstance, GameEvent, PlayerId, Zone } from "../engine/types";
import { PLAYER_IDS } from "../engine/types";
import { isHiddenCard, type ViewCardInstance, type ViewGameState, type ViewPlayerState } from "../engine/viewState";
import type { Beat } from "./choreography";

const ZONES: Zone[] = ["deck", "resourceDeck", "shields", "resourceArea", "battleArea", "baseSection", "trash", "exile", "hand"];

interface Located {
  player: PlayerId;
  zone: Zone;
  index: number;
  card: ViewCardInstance;
}

function locate(view: ViewGameState, id: string): Located | null {
  for (const player of PLAYER_IDS) {
    for (const zone of ZONES) {
      const index = view.players[player][zone].findIndex((c) => c.instanceId === id);
      if (index >= 0) return { player, zone, index, card: view.players[player][zone][index] };
    }
  }
  return null;
}

/** cópia rasa da mesa com zonas novas (as cartas em si não mudam: quem muda troca a carta inteira) */
function cloneView(view: ViewGameState): ViewGameState {
  const players = {} as Record<PlayerId, ViewPlayerState>;
  for (const p of PLAYER_IDS) {
    const src = view.players[p];
    const next = { ...src, counts: { ...src.counts } } as ViewPlayerState;
    for (const zone of ZONES) next[zone] = [...src[zone]];
    players[p] = next;
  }
  return { ...view, players };
}

function syncCounts(view: ViewGameState): void {
  for (const p of PLAYER_IDS) for (const zone of ZONES) view.players[p].counts[zone] = view.players[p][zone].length;
}

function remove(view: ViewGameState, id: string): ViewCardInstance | null {
  const at = locate(view, id);
  if (!at) return null;
  view.players[at.player][at.zone].splice(at.index, 1);
  return at.card;
}

/** carta da mesa mostrada sem o que ainda não aconteceu nela: dano e descanso continuam os da mesa mostrada */
function withShownCounters(next: ViewCardInstance, shown: ViewCardInstance | null): ViewCardInstance {
  if (!shown || isHiddenCard(next) || isHiddenCard(shown)) return next;
  return { ...next, damage: (shown as CardInstance).damage, rested: (shown as CardInstance).rested };
}

/**
 * Leva a carta para onde ela está no "depois" (mesma zona, mesma posição até onde der). `keepCounters`: na mesma
 * zona, dano e descanso ficam os da mesa mostrada (outro tempo cuida deles).
 */
function reveal(view: ViewGameState, final: ViewGameState, id: string, keepCounters = true): void {
  const target = locate(final, id);
  const shown = locate(view, id);
  if (!target) return;
  if (shown) view.players[shown.player][shown.zone].splice(shown.index, 1);
  const sameZone = shown && shown.player === target.player && shown.zone === target.zone;
  const card = keepCounters && sameZone ? withShownCounters(target.card, shown.card) : target.card;
  const zone = view.players[target.player][target.zone];
  zone.splice(Math.min(target.index, zone.length), 0, card);
}

function patchCard(view: ViewGameState, id: string, patch: (card: CardInstance) => CardInstance): void {
  const at = locate(view, id);
  if (!at || isHiddenCard(at.card)) return;
  view.players[at.player][at.zone][at.index] = patch(at.card as CardInstance);
}

function finalCard(final: ViewGameState, id: string): CardInstance | null {
  const at = locate(final, id);
  return at && !isHiddenCard(at.card) ? (at.card as CardInstance) : null;
}

function applyEffectEvent(view: ViewGameState, final: ViewGameState, event: GameEvent): void {
  switch (event.type) {
    case "DAMAGE_UNIT": {
      const after = finalCard(final, event.instanceId);
      // nunca mostra mais dano do que a Unit terminou com (proteções reduzem o dano depois do evento)
      patchCard(view, event.instanceId, (c) => ({
        ...c,
        damage: after && after.zone === c.zone ? Math.min(after.damage, c.damage + event.amount) : c.damage + event.amount,
      }));
      break;
    }
    case "HEAL_UNIT":
      patchCard(view, event.instanceId, (c) => ({ ...c, damage: Math.max(0, c.damage - event.amount) }));
      break;
    case "REST_CARD":
      patchCard(view, event.instanceId, (c) => ({ ...c, rested: true }));
      break;
    case "SET_ACTIVE":
      patchCard(view, event.instanceId, (c) => ({ ...c, rested: false }));
      break;
    case "PAIR_CARDS":
      reveal(view, final, event.pilotId);
      reveal(view, final, event.unitId);
      break;
    case "DRAW_CARD":
      if (event.instanceId) reveal(view, final, event.instanceId, false);
      break;
    case "MODIFY_STAT":
    case "GRANT_KEYWORD":
    case "SET_CANNOT_ATTACK":
    case "SET_CANNOT_ACTIVATE":
    case "DAMAGE_BASE":
      reveal(view, final, event.instanceId, event.type !== "DAMAGE_BASE");
      break;
    default:
      // destruição, escudos e saídas têm o próprio tempo (`departure`); o resto não aparece na mesa
      break;
  }
}

/** a compra sem id (a do oponente pode vir redigida): a 1ª carta da mão do "depois" que a mesa ainda não mostra */
function revealUnknownDraw(view: ViewGameState, final: ViewGameState, player: PlayerId): void {
  const shownHand = new Set(view.players[player].hand.map((c) => c.instanceId));
  const drawn = final.players[player].hand.find((c) => !shownHand.has(c.instanceId));
  if (drawn) reveal(view, final, drawn.instanceId, false);
}

/**
 * A mesa depois de `beat` tocar, partindo de `shown` (o que a tela mostra agora) e olhando `final` (a visão do
 * servidor). Escudos quebrados saem do topo da mesa mostrada, na ordem dos tempos.
 */
export function revealBeat(shown: ViewGameState, final: ViewGameState, beat: Beat): ViewGameState {
  const view = cloneView(shown);
  switch (beat.kind) {
    case "effects":
      for (const event of beat.events) applyEffectEvent(view, final, event);
      break;
    case "draw":
      if (beat.instanceId && locate(final, beat.instanceId)) reveal(view, final, beat.instanceId, false);
      else revealUnknownDraw(view, final, beat.player);
      break;
    case "play": {
      // o custo pago fica deitado
      for (const id of beat.paid) patchCard(view, id, (c) => ({ ...c, rested: true }));
      // a Command usada vai para a lixeira; Unit/Base/Piloto chegam ao campo
      reveal(view, final, beat.instanceId, false);
      if (beat.as === "command") break;
      // carta que acabou de entrar não tem dano: o que vier no lote é de tempos seguintes
      patchCard(view, beat.instanceId, (c) => ({ ...c, damage: 0 }));
      if (beat.as === "pilot") {
        const unit = PLAYER_IDS.flatMap((p) => final.players[p].battleArea).find(
          (c) => !isHiddenCard(c) && (c as CardInstance).pairedPilotId === beat.instanceId,
        );
        if (unit) reveal(view, final, unit.instanceId);
      }
      break;
    }
    case "departure": {
      const ids = beat.shieldsOf ? view.players[beat.shieldsOf].shields.slice(0, beat.count ?? 0).map((c) => c.instanceId) : beat.ids;
      for (const id of ids) {
        if (locate(final, id)) reveal(view, final, id, false);
        else remove(view, id);
      }
      break;
    }
    case "announce":
      // o custo da habilidade ativada fica deitado
      for (const id of beat.paid) patchCard(view, id, (c) => ({ ...c, rested: true }));
      break;
    case "declare":
      // o atacante deita e o combate aparece na mesa (a linha de mira), mesmo quando o ataque inteiro veio num lote só
      if (beat.rests) patchCard(view, beat.attackerId, (c) => ({ ...c, rested: true }));
      // montado só do evento (o combate do "depois" pode já ter bloqueio ou ser outro ataque)
      view.combat = {
        step: "block",
        attackerId: beat.attackerId,
        attackingPlayer: beat.attackingPlayer,
        defendingPlayer: beat.defendingPlayer,
        originalTarget: beat.target,
        currentTarget: beat.target,
        actionPasses: { A: false, B: false },
        actionPriority: beat.defendingPlayer,
      } as ViewGameState["combat"];
      break;
    case "block":
      if (beat.rests) patchCard(view, beat.blockerId, (c) => ({ ...c, rested: true }));
      if (view.combat) view.combat = { ...view.combat, currentTarget: beat.newTarget, blockerUsedBy: beat.blockerId };
      break;
    case "strike":
      break;
  }
  syncCounts(view);
  return view;
}

/** a mesa com estas cartas deitadas (`rested`) ou de pé — o pagamento gira os recursos um a um */
export function withRested(shown: ViewGameState, ids: readonly string[], rested: boolean): ViewGameState {
  const view = cloneView(shown);
  for (const id of ids) patchCard(view, id, (c) => ({ ...c, rested }));
  return view;
}

/** quem um tempo de efeito deita e levanta (o giro aparece na hora em que a mesa muda) */
export function restChanges(events: readonly GameEvent[]): { rest: string[]; stand: string[] } {
  const rest: string[] = [];
  const stand: string[] = [];
  for (const e of events) {
    if (e.type === "REST_CARD") rest.push(e.instanceId);
    else if (e.type === "SET_ACTIVE") stand.push(e.instanceId);
  }
  return { rest, stand };
}
