import type { GameState, PlayerId } from "../engine/types";
import { createGame, type DeckList } from "../engine/setup";
import { advanceToMainPhase } from "../engine/phases";
import { applyPlayerAction, playerHasActionStepPlay, type PlayerAction } from "../engine/actions";
import { applyEvents } from "../engine/events";
import { viewStateFor, type ViewGameState } from "../engine/viewState";
import { ALL_EFFECT_SPECS, defaultPredicateResolver } from "../content";

/**
 * Match store em memória (docs/18, passo 4 — decisão original do Willen: em
 * memória, sem persistência, sincronização por SSE; ampliada em
 * 2026-08-30 pra fila de matchmaking automática, timer de turno e W.O. por
 * abandono, aberta a qualquer usuário logado — ver "Simulador Beta,
 * matchmaking e timer de turno" no docs/18). Cada `MatchRecord` guarda o
 * `GameState` REAL — nunca sai daqui inteiro; só `viewStateFor`/
 * `viewStatesForBothPlayers` (engine/viewState.ts) saem pra rede, um por
 * jogador, já redigido. As rotas HTTP (`server/index.ts`) só chamam as
 * funções deste módulo — nenhuma delas toca `GameState` direto.
 *
 * Sem persistência de propósito: reiniciar o servidor derruba toda partida
 * em andamento (e a fila de matchmaking) — aceitável pro escopo atual
 * (ainda não é a Fase 3/PvP "de verdade", só adianta matchmaking/timer
 * dela conscientemente, ver docs/18).
 */

export interface MatchSeat {
  userId: string;
  displayName: string;
  /**
   * docs/19, Sessão 2, tarefa 4: quando ligado, o servidor passa
   * automaticamente o Action Step (de combate ou de fim de turno) por este
   * assento se ele não tiver nenhuma jogada 【Action】 real disponível — sem
   * esperar o timer de 90s. Default `false` (o jogador confirma cada passe).
   */
  autoPassActionStep?: boolean;
}

/** 90s por decisão (não por turno inteiro) — decisão do Willen em 2026-08-30. Estourou, o servidor age sozinho (ver `onTurnTimeout`). */
const TURN_DECISION_MS = 90_000;

/** 3min sem nenhum sinal de vida do assento oposto — decisão do Willen em 2026-08-30. Não é automático: só destrava o botão de W.O. pro oponente (ver `claimAbandonWin`). */
const ABANDON_THRESHOLD_MS = 180_000;

/**
 * 5min sem NENHUM sinal de vida (ping OU ação) do assento que precisa decidir:
 * o servidor ENCERRA a partida por abandono (vitória do oponente) em vez de
 * seguir jogando a ação-padrão sozinho, turno após turno — era isso que fazia
 * "o jogo rodar ininterrupto mesmo com muito tempo AFK" (P4). Mais folgado que
 * `ABANDON_THRESHOLD_MS` (o W.O. manual) porque aqui é automático e definitivo;
 * enquanto a aba do jogador estiver aberta ela manda ping e isso não dispara.
 */
const AUTO_FORFEIT_MS = 300_000;

export interface MatchRecord {
  id: string;
  state: GameState;
  seats: Partial<Record<PlayerId, MatchSeat>>;
  /** deck (chave "ST01"/"ST02"...) escolhido por cada lado na fila — só rótulo de exibição, o `GameState` já nasceu com as cartas certas. */
  deckKeys: Partial<Record<PlayerId, string>>;
  createdAt: number;
  updatedAt: number;
  /** incrementa a cada `applyAction` — conveniência pra cliente detectar "cheguei atrasado" numa reconexão de SSE */
  version: number;
  /** timestamp (epoch ms) até quando a decisão atual pode ser tomada antes do servidor agir sozinho — `null` quando não há decisão pendente (partida ainda não tem os 2 assentos ocupados, ou já terminou). */
  turnDeadlineAt: number | null;
  /** último sinal de vida (ping do cliente OU qualquer ação real) de cada assento — base do W.O. por abandono. */
  lastSeenAt: Partial<Record<PlayerId, number>>;
}

export class MatchError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Visão que sai pra rede: `ViewGameState` (regra de jogo, já redigida por
 * `viewStateFor`) mais os metadados de partida que não são regra de jogo
 * nenhuma — por isso ficam aqui, não em `engine/viewState.ts` (o motor
 * continua sem saber que existe rede/matchmaking/timer). `turnDeadlineAt` e
 * `lastSeenAt` não são segredo de ninguém — os 2 lados recebem os mesmos
 * valores, dá pra mostrar o relógio e a presença do oponente sem vazar
 * nenhuma informação de jogo oculta.
 */
export interface MatchView {
  view: ViewGameState;
  matchId: string;
  seat: PlayerId;
  deckKeys: Partial<Record<PlayerId, string>>;
  turnDeadlineAt: number | null;
  lastSeenAt: Partial<Record<PlayerId, number>>;
  version: number;
  /** valor de `autoPassActionStep` do assento deste viewer (docs/19, Sessão 2) — pra UI renderizar o toggle. */
  autoPassActionStep: boolean;
}

export function matchViewFor(match: MatchRecord, seat: PlayerId): MatchView {
  return {
    view: viewStateFor(match.state, seat),
    matchId: match.id,
    seat,
    deckKeys: match.deckKeys,
    turnDeadlineAt: match.turnDeadlineAt,
    lastSeenAt: match.lastSeenAt,
    version: match.version,
    autoPassActionStep: match.seats[seat]?.autoPassActionStep ?? false,
  };
}

function matchViewsForBothPlayers(match: MatchRecord): Record<PlayerId, MatchView> {
  return { A: matchViewFor(match, "A"), B: matchViewFor(match, "B") };
}

type Listener = (views: Record<PlayerId, MatchView>, match: MatchRecord) => void;

const matches = new Map<string, MatchRecord>();
const listeners = new Map<string, Set<Listener>>();
// `ReturnType<typeof setTimeout>` (não `NodeJS.Timeout`) porque este arquivo mora em `src/`
// (tipado pra browser, sem @types/node) mesmo só rodando no server em runtime.
const turnTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export interface CreateMatchOptions {
  deckA: DeckList;
  deckB: DeckList;
  /** default: aleatório — só passe um valor fixo em teste, pra determinismo */
  seed?: number;
  firstPlayer?: PlayerId;
}

/** Cria a partida e já avança até a Main Phase do 1º jogador (Start/Draw/Resource não exigem decisão de ninguém). */
export function createMatch(opts: CreateMatchOptions): MatchRecord {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const firstPlayer = opts.firstPlayer ?? "A";
  const state = advanceToMainPhase(createGame(opts.deckA, opts.deckB, { seed, firstPlayer }));

  const now = Date.now();
  const match: MatchRecord = {
    id: crypto.randomUUID(),
    state,
    seats: {},
    deckKeys: {},
    createdAt: now,
    updatedAt: now,
    version: 1,
    turnDeadlineAt: null,
    lastSeenAt: {},
  };
  matches.set(match.id, match);
  return match;
}

/**
 * "GC" oportunista do store em memória (docs/19, Sessão 4 — evitar acúmulo
 * indefinido): partida terminada some 10min depois da última atualização
 * (tempo de sobra pros 2 lados verem o resultado); partida que nunca teve os
 * 2 assentos ocupados some depois de 15min. Chamado das rotas de escrita
 * (`applyAction`, `joinQueue`, `onTurnTimeout`) — sem `setInterval` de fundo,
 * pra não vazar timer nem interferir em teste.
 */
const FINISHED_MATCH_TTL_MS = 10 * 60_000;
const UNSEATED_MATCH_TTL_MS = 15 * 60_000;

function sweepStaleMatches(): void {
  const now = Date.now();
  for (const [id, m] of matches) {
    const finishedStale = !!m.state.gameOver && now - m.updatedAt > FINISHED_MATCH_TTL_MS;
    const neverSeated = !m.seats.A && !m.seats.B && now - m.createdAt > UNSEATED_MATCH_TTL_MS;
    if (finishedStale || neverSeated) deleteMatch(id);
  }
}

export function getMatch(matchId: string): MatchRecord | undefined {
  return matches.get(matchId);
}

export function listMatches(): MatchRecord[] {
  return [...matches.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function requireMatch(matchId: string): MatchRecord {
  const match = matches.get(matchId);
  if (!match) throw new MatchError("Partida não encontrada (pode ter sido derrubada por restart — não há persistência).", 404);
  return match;
}

/** Qual assento (A/B) esse usuário ocupa nesta partida, se algum. */
export function seatFor(match: MatchRecord, userId: string): PlayerId | undefined {
  for (const seat of ["A", "B"] as PlayerId[]) {
    if (match.seats[seat]?.userId === userId) return seat;
  }
  return undefined;
}

/**
 * Um usuário entra num assento (A ou B) — nunca troca depois de ocupado.
 * Rejeita se o assento já tem OUTRO usuário, e rejeita o mesmo usuário
 * ocupar os 2 assentos (isso destruiria o próprio propósito do teste: 2
 * contas reais, 2 sessões reais, ver docs/18). Usada tanto pelo pareamento
 * automático da fila (`joinQueue`) quanto por uma reconexão de aba.
 */
export function joinMatch(matchId: string, seat: PlayerId, player: MatchSeat): MatchRecord {
  const match = requireMatch(matchId);

  const currentOccupant = match.seats[seat];
  if (currentOccupant && currentOccupant.userId !== player.userId) {
    throw new MatchError(`Assento ${seat} já está ocupado por outro jogador.`, 409);
  }

  const otherSeat: PlayerId = seat === "A" ? "B" : "A";
  if (match.seats[otherSeat]?.userId === player.userId) {
    throw new MatchError("Esse usuário já ocupa o assento oposto nesta partida — use 2 contas diferentes.", 409);
  }

  match.seats[seat] = player;
  match.lastSeenAt[seat] = Date.now();
  match.updatedAt = Date.now();
  armTurnTimer(match);
  notify(match);
  return match;
}

/** Aplica a ação do usuário (identificado por `userId`, não por `PlayerId` — o assento é resolvido aqui). */
export function applyAction(matchId: string, userId: string, action: PlayerAction): MatchRecord {
  sweepStaleMatches();
  const match = requireMatch(matchId);
  const seat = seatFor(match, userId);
  if (!seat) throw new MatchError("Esse usuário não é jogador desta partida (precisa entrar num assento primeiro).", 403);
  if (match.state.gameOver) throw new MatchError("A partida já terminou.", 409);

  let nextState: GameState;
  try {
    nextState = applyPlayerAction(match.state, seat, action, ALL_EFFECT_SPECS, defaultPredicateResolver);
  } catch (err) {
    throw new MatchError(err instanceof Error ? err.message : "Ação inválida.", 400);
  }

  match.state = nextState;
  match.lastSeenAt[seat] = Date.now();
  match.updatedAt = Date.now();
  match.version += 1;
  armTurnTimer(match);
  notify(match);
  return match;
}

/** Atualiza o "último sinal de vida" de um assento sem mudar nada do jogo — chamada pelo ping periódico do cliente (ver server/index.ts). Notifica os assinantes (SSE) pra que o OUTRO lado veja a presença atualizada mesmo sem nenhuma ação de jogo acontecer. */
export function touchPresence(matchId: string, userId: string): MatchRecord {
  const match = requireMatch(matchId);
  const seat = seatFor(match, userId);
  if (!seat) throw new MatchError("Esse usuário não é jogador desta partida.", 403);
  match.lastSeenAt[seat] = Date.now();
  notify(match);
  return match;
}

/**
 * Liga/desliga o auto-pass de Action Step pro assento desse usuário (docs/19,
 * Sessão 2). Reavalia na hora — se o jogador já está num Action Step sem
 * jogada e acabou de ligar a opção, o `armTurnTimer` abaixo já passa por ele.
 */
export function setAutoPass(matchId: string, userId: string, value: boolean): MatchRecord {
  const match = requireMatch(matchId);
  const seat = seatFor(match, userId);
  if (!seat) throw new MatchError("Esse usuário não é jogador desta partida.", 403);
  match.seats[seat] = { ...match.seats[seat]!, autoPassActionStep: value };
  match.updatedAt = Date.now();
  armTurnTimer(match);
  notify(match);
  return match;
}

/**
 * Ferramenta in-game "Reportar Situação de Regra" (docs/19, Sessão 4). Não
 * persiste em banco — só emite um `console.warn` estruturado com o
 * `GameState` REAL (não redigido) + histórico de eventos, pra diagnóstico
 * pelo dev nos logs do servidor. Devolve um `reportId` curto que o jogador
 * vê na tela (e que aparece no log), pra casar o relato com a linha certa.
 */
export function reportSituation(matchId: string, userId: string, note?: string): { reportId: string } {
  const match = requireMatch(matchId);
  const seat = seatFor(match, userId);
  if (!seat) throw new MatchError("Esse usuário não é jogador desta partida.", 403);

  const reportId = Math.random().toString(36).slice(2, 8).toUpperCase();
  console.warn(
    `[SIMULADOR][RULE-REPORT ${reportId}] match=${matchId} seat=${seat} version=${match.state.turnNumber}t note=${JSON.stringify(note ?? "")}\n` +
      JSON.stringify({ reportId, matchId, seat, note, at: Date.now(), deckKeys: match.deckKeys, state: match.state }),
  );
  return { reportId };
}

/** Partida ainda não terminada onde esse usuário já ocupa um assento, se alguma — usado pra "reconectar" direto em vez de enfileirar de novo. */
export function activeMatchForUser(userId: string): { match: MatchRecord; seat: PlayerId } | undefined {
  for (const match of matches.values()) {
    if (match.state.gameOver) continue;
    const seat = seatFor(match, userId);
    if (seat) return { match, seat };
  }
  return undefined;
}

/**
 * W.O. por abandono (decisão do Willen: nunca automático — só destrava um
 * botão pro oponente clicar). Só aceita se o assento oposto está sem
 * nenhum sinal de vida (ping ou ação) há pelo menos `ABANDON_THRESHOLD_MS`.
 */
export function claimAbandonWin(matchId: string, userId: string): MatchRecord {
  const match = requireMatch(matchId);
  const seat = seatFor(match, userId);
  if (!seat) throw new MatchError("Esse usuário não é jogador desta partida.", 403);
  if (match.state.gameOver) throw new MatchError("A partida já terminou.", 409);

  const opponentSeat: PlayerId = seat === "A" ? "B" : "A";
  if (!match.seats[opponentSeat]) throw new MatchError("O oponente nunca chegou a entrar nesta partida.", 409);

  const opponentLastSeen = match.lastSeenAt[opponentSeat];
  const idleMs = opponentLastSeen ? Date.now() - opponentLastSeen : Number.POSITIVE_INFINITY;
  if (idleMs < ABANDON_THRESHOLD_MS) {
    const remainingSeconds = Math.ceil((ABANDON_THRESHOLD_MS - idleMs) / 1000);
    throw new MatchError(`Ainda não dá pra declarar W.O. — faltam ${remainingSeconds}s de inatividade do oponente.`, 409);
  }

  match.state = applyEvents(match.state, [{ type: "GAME_OVER", winner: seat, reason: "abandonment" }]);
  match.updatedAt = Date.now();
  match.version += 1;
  armTurnTimer(match);
  notify(match);
  return match;
}

/**
 * Desistência imediata ("Sair da partida"): o próprio jogador encerra o duelo
 * e concede a vitória ao oponente por abandono. Diferente de `claimAbandonWin`
 * (que exige 3min de inatividade do OUTRO lado) — aqui não há espera nem
 * checagem de turno/prioridade. Se a partida já acabou, é no-op (sair vira só
 * navegação). Se o oponente nunca entrou, não há pra quem conceder — a partida
 * é descartada (nunca começou de verdade) e o chamador só navega embora.
 */
export function resignMatch(matchId: string, userId: string): MatchRecord {
  const match = requireMatch(matchId);
  const seat = seatFor(match, userId);
  if (!seat) throw new MatchError("Esse usuário não é jogador desta partida.", 403);
  if (match.state.gameOver) return match;

  const opponentSeat: PlayerId = seat === "A" ? "B" : "A";
  if (!match.seats[opponentSeat]) {
    // Sem oponente pra conceder a vitória — a partida nunca começou de verdade.
    // Descarta em vez de deixar um zumbi que `activeMatchForUser` reconecta pra
    // sempre (era isso que fazia "entrar no simulador" cair na partida velha).
    // Ainda seta GAME_OVER no `state` antes de descartar pra o registro devolvido
    // ficar consistente com as irmãs (`claimAbandonWin`/`onTurnTimeout`): quem
    // consome o retorno nunca vê um tabuleiro "vivo" de uma partida que já não existe.
    match.state = applyEvents(match.state, [{ type: "GAME_OVER", winner: opponentSeat, reason: "abandonment" }]);
    deleteMatch(matchId);
    return match;
  }

  match.state = applyEvents(match.state, [{ type: "GAME_OVER", winner: opponentSeat, reason: "abandonment" }]);
  match.updatedAt = Date.now();
  match.version += 1;
  armTurnTimer(match);
  notify(match);
  return match;
}

// ---------------------------------------------------------------------------
// Fila de matchmaking ("Simulador Beta") — decisão do Willen em 2026-08-30:
// 1 botão só, sem escolher adversário/assento manualmente; cada jogador
// escolhe o próprio deck (ST01/ST02, qualquer combinação, incluindo o mesmo
// deck dos 2 lados); ao ter 2 na fila, pareia os 2 primeiros (FIFO) e cria a
// partida sozinho. Aberta a qualquer usuário logado (não mais só
// admin/hoster).
// ---------------------------------------------------------------------------

export interface QueueJoinInput {
  userId: string;
  displayName: string;
  /** rótulo do deck escolhido (ex. "ST01") — só exibição, ver `MatchRecord.deckKeys` */
  deckKey: string;
  deckList: DeckList;
}

export interface QueueStatus {
  queued: boolean;
  matched: boolean;
  matchId?: string;
  seat?: PlayerId;
}

interface QueueEntry extends QueueJoinInput {
  queuedAt: number;
}

const queue: QueueEntry[] = [];
/** resultado de pareamento à espera do jogador que não foi quem disparou o match nesta chamada (ver `joinQueue`) — lido via polling em `queueStatusFor`. */
const pendingMatches = new Map<string, QueueStatus>();

/** Idempotente: chamar de novo com o mesmo usuário só atualiza o deck escolhido, nunca duplica a entrada. Se o usuário já está numa partida ativa (reconexão), devolve ela direto em vez de enfileirar de novo. */
export function joinQueue(input: QueueJoinInput): QueueStatus {
  sweepStaleMatches();
  const alreadyPlaying = activeMatchForUser(input.userId);
  if (alreadyPlaying) {
    return { queued: false, matched: true, matchId: alreadyPlaying.match.id, seat: alreadyPlaying.seat };
  }

  pendingMatches.delete(input.userId);

  const existing = queue.find((entry) => entry.userId === input.userId);
  if (existing) {
    existing.deckKey = input.deckKey;
    existing.deckList = input.deckList;
  } else {
    queue.push({ ...input, queuedAt: Date.now() });
  }

  while (queue.length >= 2) {
    const [first, second] = queue.splice(0, 2);
    if (first.userId === second.userId) {
      // a mesma conta entrou 2x (ex.: 2 abas) — devolve a 2ª tentativa pro início da fila e para por aqui, não forma partida consigo mesma.
      queue.unshift(second);
      break;
    }

    const match = createMatch({ deckA: first.deckList, deckB: second.deckList, firstPlayer: Math.random() < 0.5 ? "A" : "B" });
    match.deckKeys = { A: first.deckKey, B: second.deckKey };
    joinMatch(match.id, "A", { userId: first.userId, displayName: first.displayName });
    joinMatch(match.id, "B", { userId: second.userId, displayName: second.displayName });

    pendingMatches.set(first.userId, { queued: false, matched: true, matchId: match.id, seat: "A" });
    pendingMatches.set(second.userId, { queued: false, matched: true, matchId: match.id, seat: "B" });
  }

  return queueStatusFor(input.userId);
}

export function queueStatusFor(userId: string): QueueStatus {
  const pending = pendingMatches.get(userId);
  if (pending?.matchId) {
    // O `pendingMatches` é só o sinal one-shot "você foi pareado, vá pra essa
    // partida" (lido no polling). Ele NÃO é limpo quando a partida termina ou
    // é descartada, então precisa validar aqui: se a partida sumiu ou já
    // acabou (fim de jogo / abandono), o pareamento está consumido — descarta
    // e cai no fluxo normal, senão o jogador reentra sempre na partida velha.
    const match = matches.get(pending.matchId);
    if (match && !match.state.gameOver) return pending;
    pendingMatches.delete(userId);
  }
  const alreadyPlaying = activeMatchForUser(userId);
  if (alreadyPlaying) return { queued: false, matched: true, matchId: alreadyPlaying.match.id, seat: alreadyPlaying.seat };
  return { queued: queue.some((entry) => entry.userId === userId), matched: false };
}

export function leaveQueue(userId: string): void {
  const index = queue.findIndex((entry) => entry.userId === userId);
  if (index !== -1) queue.splice(index, 1);
  pendingMatches.delete(userId);
}

// ---------------------------------------------------------------------------
// Timer de turno — 1 setTimeout por partida, sempre reagendado a cada ação
// real (nunca 2 timers vivos pra mesma partida ao mesmo tempo).
// ---------------------------------------------------------------------------

/** Quem precisa agir agora, se algum — `null` quando o passo é transitório (resolvido sozinho por `applyPlayerAction`) ou não há decisão pendente. */
/** exportado só pra teste — quem precisa agir agora (`null` se o passo é transitório). */
export function decisionOwner(state: GameState): PlayerId | null {
  if (state.gameOver) return null;
  // Decisão interativa pendente (docs/19, Sessão 2) tem prioridade sobre
  // qualquer passo — é a vez DAQUELE jogador resolver (Burst / ordem de gatilhos).
  for (const p of ["A", "B"] as PlayerId[]) {
    if (state.pendingDecision[p]) return p;
  }
  if (state.combat) {
    if (state.combat.step === "block") return state.combat.defendingPlayer;
    if (state.combat.step === "action") return state.combat.actionPriority;
    return null; // attack/damage/battleEnd são passos automáticos, nunca ficam "parados" esperando decisão
  }
  // Action Step da End Phase (mesma mecânica do Action Step de combate, ver
  // phases.ts/beginEndPhaseActionStep) — quem tem `endPhaseAction.priority`
  // precisa agir (jogar Command 【Action】 ou passar) antes do turno realmente terminar.
  if (state.endPhaseAction) return state.endPhaseAction.priority;
  if (state.phase === "main") return state.activePlayer;
  return null;
}

/** A ação que o timer executa sozinho quando estoura, pro passo atual — sempre a opção "não fazer nada de especial" de cada passo. */
/** exportado só pra teste — a ação-padrão que o timer executa pro passo atual. */
export function defaultActionFor(state: GameState): PlayerAction {
  // Decisão interativa pendente: a opção "não fazer nada de especial" é
  // recusar o Burst / manter a ordem de gatilhos como está.
  for (const p of ["A", "B"] as PlayerId[]) {
    const pending = state.pendingDecision[p];
    if (pending?.kind === "burst") return { kind: "resolveBurstDecision", activate: false };
    if (pending?.kind === "triggerOrder") {
      return { kind: "resolveTriggerOrder", orderedSpecIds: pending.triggers.map((t) => t.specId) };
    }
    if (pending?.kind === "abilityResolution") {
      // AFK durante a resolução de habilidade (When Paired / Attack / …): pula os
      // optativos e resolve os mandatórios sem alvo (o motor trata `targetIds: []`
      // como "nada acontece").
      return {
        kind: "resolveAbility",
        resolutions: pending.queue.map((q) => ({ specId: q.specId, activate: !q.optional, targetIds: [] })),
      };
    }
  }
  if (state.combat?.step === "block") return { kind: "skipBlock" };
  if (state.combat?.step === "action") return { kind: "passAction" };
  if (state.endPhaseAction) return { kind: "passEndPhaseAction" };
  return { kind: "finishTurn" };
}

function clearTurnTimer(matchId: string): void {
  const handle = turnTimeouts.get(matchId);
  if (handle) {
    clearTimeout(handle);
    turnTimeouts.delete(matchId);
  }
}

/**
 * Auto-pass inteligente do Action Step (docs/19, Sessão 2, tarefa 4): se o
 * jogador com prioridade num Action Step (combate OU fim de turno) ligou
 * `autoPassActionStep` e não tem nenhuma jogada 【Action】 real, passa na
 * hora — sem cobrar os 90s do timer. Loop limitado: cada passe ou vira a
 * prioridade uma vez ou encerra o step, então converge em poucas iterações
 * (e para assim que o outro lado não tem auto-pass ligado, ou surge uma
 * decisão de Burst, ou o step termina).
 */
function settleAutoPasses(match: MatchRecord): void {
  for (let i = 0; i < 6; i++) {
    if (match.state.gameOver) return;
    const owner = decisionOwner(match.state);
    if (!owner) return;

    const inCombatActionStep = match.state.combat?.step === "action";
    const inEndPhaseActionStep = match.state.endPhaseAction != null;
    if (!inCombatActionStep && !inEndPhaseActionStep) return;
    if (!match.seats[owner]?.autoPassActionStep) return;
    if (playerHasActionStepPlay(match.state, owner, ALL_EFFECT_SPECS)) return;

    const pass: PlayerAction = inCombatActionStep ? { kind: "passAction" } : { kind: "passEndPhaseAction" };
    try {
      match.state = applyPlayerAction(match.state, owner, pass, ALL_EFFECT_SPECS, defaultPredicateResolver);
      match.version += 1;
      match.updatedAt = Date.now();
    } catch {
      return;
    }
  }
}

/** Cancela e reagenda o timer de turno pro estado atual da partida — chamar depois de QUALQUER mutação de `match.state`. */
function armTurnTimer(match: MatchRecord): void {
  settleAutoPasses(match);
  clearTurnTimer(match.id);

  if (match.state.gameOver || !match.seats.A || !match.seats.B || !decisionOwner(match.state)) {
    match.turnDeadlineAt = null;
    return;
  }

  const deadline = Date.now() + TURN_DECISION_MS;
  match.turnDeadlineAt = deadline;
  const handle = setTimeout(() => onTurnTimeout(match.id, deadline), TURN_DECISION_MS);
  turnTimeouts.set(match.id, handle);
}

function onTurnTimeout(matchId: string, expectedDeadline: number): void {
  turnTimeouts.delete(matchId);
  sweepStaleMatches();
  const match = matches.get(matchId);
  if (!match) return;
  // a partida já mudou de estado (ação real, ou já tinha sido reagendada) desde que este timeout foi criado — não faz nada, quem reagendou já cuidou.
  if (match.turnDeadlineAt !== expectedDeadline) return;
  if (match.state.gameOver) return;

  const actingPlayer = decisionOwner(match.state);
  if (actingPlayer) {
    // AFK prolongado: se quem precisa decidir não dá sinal de vida (ping ou
    // ação) há `AUTO_FORFEIT_MS`, encerra por abandono em vez de jogar sozinho
    // pra sempre. Só quando os 2 assentos estão ocupados (partida de verdade).
    const bothSeated = !!match.seats.A && !!match.seats.B;
    const lastSeen = match.lastSeenAt[actingPlayer];
    const idleMs = lastSeen ? Date.now() - lastSeen : Number.POSITIVE_INFINITY;
    if (bothSeated && idleMs >= AUTO_FORFEIT_MS) {
      const opponentSeat: PlayerId = actingPlayer === "A" ? "B" : "A";
      match.state = applyEvents(match.state, [{ type: "GAME_OVER", winner: opponentSeat, reason: "abandonment" }]);
      match.updatedAt = Date.now();
      match.version += 1;
      clearTurnTimer(match.id);
      match.turnDeadlineAt = null;
      notify(match);
      return;
    }

    try {
      match.state = applyPlayerAction(match.state, actingPlayer, defaultActionFor(match.state), ALL_EFFECT_SPECS, defaultPredicateResolver);
      match.updatedAt = Date.now();
      match.version += 1;
    } catch {
      // a ação-padrão do passo virou ilegal por algum motivo inesperado (não deveria acontecer) — não trava o relógio, só rearma abaixo.
    }
  }

  armTurnTimer(match);
  notify(match);
}

/** Assina atualizações de uma partida (visão já redigida por jogador). Devolve a função de cancelamento. */
export function subscribe(matchId: string, listener: Listener): () => void {
  let set = listeners.get(matchId);
  if (!set) {
    set = new Set();
    listeners.set(matchId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(matchId);
  };
}

function notify(match: MatchRecord): void {
  const set = listeners.get(match.id);
  if (!set || set.size === 0) return;
  const views = matchViewsForBothPlayers(match);
  for (const listener of set) listener(views, match);
}

export function deleteMatch(matchId: string): void {
  clearTurnTimer(matchId);
  matches.delete(matchId);
  listeners.delete(matchId);
  // Não deixa `pendingMatches` apontando pra uma partida que não existe mais —
  // senão `queueStatusFor` mandaria o jogador de volta pra ela (agora tem um
  // guard lá também, mas limpar na fonte evita entrada morta na memória).
  for (const [userId, status] of pendingMatches) {
    if (status.matchId === matchId) pendingMatches.delete(userId);
  }
}

/** Só pra teste — evita vazar estado de um `it()` pro outro (o store é module-level, não por-request). */
export function _resetAllMatchesForTests(): void {
  for (const handle of turnTimeouts.values()) clearTimeout(handle);
  turnTimeouts.clear();
  matches.clear();
  listeners.clear();
  queue.length = 0;
  pendingMatches.clear();
}
